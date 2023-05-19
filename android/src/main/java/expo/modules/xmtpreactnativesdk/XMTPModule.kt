package expo.modules.xmtpreactnativesdk

import android.util.Base64
import android.util.Base64.NO_WRAP
import android.util.Log
import com.google.protobuf.kotlin.toByteString
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.xmtpreactnativesdk.wrappers.ConversationWithClientAddress
import expo.modules.xmtpreactnativesdk.wrappers.ConversationWrapper
import expo.modules.xmtpreactnativesdk.wrappers.DecodedMessageWrapper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import org.xmtp.android.library.Client
import org.xmtp.android.library.ClientOptions
import org.xmtp.android.library.Conversation
import org.xmtp.android.library.SigningKey
import org.xmtp.android.library.XMTPEnvironment
import org.xmtp.android.library.XMTPException
import org.xmtp.android.library.messages.EnvelopeBuilder
import org.xmtp.android.library.messages.InvitationV1ContextBuilder
import org.xmtp.android.library.messages.PrivateKeyBuilder
import org.xmtp.android.library.messages.Signature
import org.xmtp.android.library.push.XMTPPush
import org.xmtp.proto.message.contents.SignatureOuterClass
import java.util.Date
import java.util.UUID
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ReactNativeSigner(var module: XMTPModule, override var address: String) : SigningKey {
    private val continuations: MutableMap<String, Continuation<Signature>> = mutableMapOf()

    fun handle(id: String, signature: String) {
        val continuation = continuations[id] ?: return
        val signatureData = Base64.decode(signature.toByteArray(), NO_WRAP)
        if (signatureData == null || signatureData.size != 65) {
            continuation.resumeWithException(XMTPException("Invalid Signature"))
            continuations.remove(id)
            return
        }
        val sig = SignatureOuterClass.Signature.newBuilder().also {
            it.ecdsaCompact = it.ecdsaCompact.toBuilder().also { builder ->
                builder.bytes = signatureData.take(64).toByteArray().toByteString()
                builder.recovery = signatureData[64].toInt()
            }.build()
        }.build()
        continuation.resume(sig)
        continuations.remove(id)
    }

    override suspend fun sign(data: ByteArray): Signature {
        val request = SignatureRequest(message = String(data, Charsets.UTF_8))
        module.sendEvent("sign", mapOf("id" to request.id, "message" to request.message))
        return suspendCancellableCoroutine { continuation ->
            continuations[request.id] = continuation
        }
    }

    override suspend fun sign(message: String): Signature =
        sign(message.toByteArray())
}

data class SignatureRequest(
    var id: String = UUID.randomUUID().toString(),
    var message: String,
)

fun Conversation.cacheKey(clientAddress: String): String {
    return if (conversationId != "") {
        "${clientAddress}:${topic}:${conversationId}"
    } else {
        "${clientAddress}:${topic}"
    }
}

class XMTPModule : Module() {
    private val apiEnvironments = mapOf(
        "local" to ClientOptions.Api(env = XMTPEnvironment.LOCAL, isSecure = false),
        "dev" to ClientOptions.Api(env = XMTPEnvironment.DEV, isSecure = true),
        "production" to ClientOptions.Api(env = XMTPEnvironment.PRODUCTION, isSecure = true)
    )

    private var clients: MutableMap<String, Client> = mutableMapOf()
    private var xmtpPush: XMTPPush? = null
    private var signer: ReactNativeSigner? = null
    private val conversations: MutableMap<String, Conversation> = mutableMapOf()
    private val subscriptions: MutableMap<String, Job> = mutableMapOf()

    override fun definition() = ModuleDefinition {
        Name("XMTP")
        Events("sign", "authed", "conversation", "message")

        Function("address") { clientAddress: String ->
            val client = clients[clientAddress]
            client?.address ?: "No Client."
        }

        //
        // Auth functions
        //
        AsyncFunction("auth") { address: String, environment: String ->
            val reactSigner = ReactNativeSigner(module = this@XMTPModule, address = address)
            signer = reactSigner
            val options =
                ClientOptions(api = apiEnvironments[environment] ?: apiEnvironments["dev"]!!)
            clients[address] = Client().create(account = reactSigner, options = options)
            signer = null
            sendEvent("authed")
        }

        Function("receiveSignature") { requestID: String, signature: String ->
            signer?.handle(id = requestID, signature = signature)
        }

        // Generate a random wallet and set the client to that
        AsyncFunction("createRandom") { environment: String ->
            val privateKey = PrivateKeyBuilder()
            val options =
                ClientOptions(api = apiEnvironments[environment] ?: apiEnvironments["dev"]!!)
            val randomClient = Client().create(account = privateKey, options = options)
            clients[randomClient.address] = randomClient
            randomClient.address
        }

        //
        // Client API
        AsyncFunction("listConversations") { clientAddress: String ->
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            val conversationList = client.conversations.list()
            conversationList.map { conversation ->
                conversations[conversation.cacheKey(clientAddress)] = conversation
                ConversationWrapper.encode(ConversationWithClientAddress(client, conversation))
            }
        }

        AsyncFunction("loadMessages") { clientAddress: String, conversationTopic: String, conversationID: String?, limit: Int?, before: Long?, after: Long? ->
            val conversation =
                findConversation(
                    clientAddress = clientAddress,
                    topic = conversationTopic,
                    conversationId = conversationID
                )
                    ?: throw XMTPException("no conversation found for $conversationTopic")
            val beforeDate = if (before != null) Date(before) else null
            val afterDate = if (after != null) Date(after) else null

            conversation.messages(limit = limit, before = beforeDate, after = afterDate)
                .map { DecodedMessageWrapper.encode(it) }
        }

        // TODO: Support content types
        AsyncFunction("sendMessage") { clientAddress: String, conversationTopic: String, conversationID: String?, content: String ->
            val conversation =
                findConversation(
                    clientAddress = clientAddress,
                    topic = conversationTopic,
                    conversationId = conversationID
                )
                    ?: throw XMTPException("no conversation found for $conversationTopic")
            val preparedMessage = conversation.prepareMessage(content = content)
            val decodedMessage = preparedMessage.decodedMessage()
            preparedMessage.send()
            DecodedMessageWrapper.encode(decodedMessage)
        }

        AsyncFunction("createConversation") { clientAddress: String, peerAddress: String, conversationID: String? ->
            val client = clients[clientAddress] ?: throw XMTPException("No client")

            val conversation = client.conversations.newConversation(
                peerAddress,
                context = InvitationV1ContextBuilder.buildFromConversation(
                    conversationId = conversationID ?: "", metadata = mapOf()
                )
            )
            ConversationWrapper.encode(ConversationWithClientAddress(client, conversation))
        }

        Function("subscribeToConversations") { clientAddress: String ->
            subscribeToConversations(clientAddress = clientAddress)
        }

        AsyncFunction("subscribeToMessages") { clientAddress: String, topic: String, conversationID: String? ->
            subscribeToMessages(
                clientAddress = clientAddress,
                topic = topic,
                conversationId = conversationID
            )
        }

        AsyncFunction("unsubscribeFromMessages") { clientAddress: String, topic: String, conversationID: String? ->
            unsubscribeFromMessages(
                clientAddress = clientAddress,
                topic = topic,
                conversationId = conversationID
            )
        }

        Function("registerPushToken") { pushServer: String, token: String ->
            xmtpPush = XMTPPush(appContext.reactContext!!, pushServer)
            xmtpPush?.register(token)
        }

        Function("subscribePushTopics") { topics: List<String> ->
            if (topics.isNotEmpty()) {
                if (xmtpPush == null) {
                    throw XMTPException("Push server not registered")
                }
                xmtpPush?.subscribe(topics)
            }
        }

        AsyncFunction("decodeMessage") { clientAddress: String, topic: String, encryptedMessage: String, conversationID: String? ->
            val encryptedMessageData = Base64.decode(encryptedMessage, Base64.NO_WRAP)
            val envelope = EnvelopeBuilder.buildFromString(topic, Date(), encryptedMessageData)
            val conversation =
                findConversation(
                    clientAddress = clientAddress,
                    topic = topic,
                    conversationId = conversationID
                )
                    ?: throw XMTPException("no conversation found for $topic")
            val decodedMessage = conversation.decode(envelope)
            DecodedMessageWrapper.encode(decodedMessage)
        }
    }

    //
    // Helpers
    //
    private fun findConversation(
        clientAddress: String,
        topic: String,
        conversationId: String?,
    ): Conversation? {
        val client = clients[clientAddress] ?: throw XMTPException("No client")

        val cacheKey: String = if (!conversationId.isNullOrBlank()) {
            "${clientAddress}:${topic}:${conversationId}"
        } else {
            "${clientAddress}:${topic}"
        }

        val cacheConversation = conversations[cacheKey]
        if (cacheConversation != null) {
            return cacheConversation
        } else {
            val conversation = client.conversations.list()
                .firstOrNull { it.topic == topic && it.conversationId == conversationId }
            if (conversation != null) {
                conversations[conversation.cacheKey(clientAddress)] = conversation
                return conversation
            }
        }
        return null
    }

    private fun subscribeToConversations(clientAddress: String) {
        val client = clients[clientAddress] ?: throw XMTPException("No client")

        subscriptions["conversations"] = CoroutineScope(Dispatchers.IO).launch {
            try {
                client!!.conversations.stream().collect { conversation ->
                    sendEvent(
                        "conversation",
                        mapOf(
                            "topic" to conversation.topic,
                            "peerAddress" to conversation.peerAddress,
                            "version" to if (conversation.version == Conversation.Version.V1) "v1" else "v2",
                            "conversationID" to conversation.conversationId
                        )
                    )
                }
            } catch (e: Exception) {
                Log.e("XMTPModule", "Error in conversations subscription: $e")
                subscriptions["conversations"]?.cancel()
            }
        }
    }

    private fun subscribeToMessages(clientAddress: String, topic: String, conversationId: String?) {
        val conversation =
            findConversation(
                clientAddress = clientAddress,
                topic = topic,
                conversationId = conversationId
            ) ?: return
        subscriptions[conversation.cacheKey(clientAddress)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    conversation.streamMessages().collect { message ->
                        sendEvent(
                            "message",
                            mapOf(
                                "topic" to conversation.topic,
                                "conversationID" to conversation.conversationId,
                                "messageJSON" to DecodedMessageWrapper.encode(message)
                            )
                        )
                    }
                } catch (e: Exception) {
                    Log.e("XMTPModule", "Error in messages subscription: $e")
                    subscriptions[conversation.cacheKey(clientAddress)]?.cancel()
                }
            }
    }

    private fun unsubscribeFromMessages(
        clientAddress: String,
        topic: String,
        conversationId: String?,
    ) {
        val conversation =
            findConversation(
                clientAddress = clientAddress,
                topic = topic,
                conversationId = conversationId
            ) ?: return
        subscriptions[conversation.cacheKey(clientAddress)]?.cancel()
    }
}


