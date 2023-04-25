package expo.modules.xmtpreactnativesdk

import android.util.Base64
import android.util.Base64.NO_WRAP
import com.google.protobuf.kotlin.toByteString
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.xmtpreactnativesdk.wrappers.ConversationWrapper
import expo.modules.xmtpreactnativesdk.wrappers.DecodedMessageWrapper
import kotlinx.coroutines.suspendCancellableCoroutine
import org.xmtp.android.library.Client
import org.xmtp.android.library.Conversation
import org.xmtp.android.library.SigningKey
import org.xmtp.android.library.XMTPException
import org.xmtp.android.library.messages.InvitationV1ContextBuilder
import org.xmtp.android.library.messages.PrivateKeyBuilder
import org.xmtp.android.library.messages.Signature
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
        module.sendEvent("sign", mapOf(Pair("id", request.id), Pair("message", request.message)))
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

val Conversation.cacheKey: String
    get() {
        return if (conversationId != "") {
            "${topic}:${conversationId}"
        } else {
            topic
        }
    }

class XMTPModule : Module() {
    var client: Client? = null
    var signer: ReactNativeSigner? = null
    val conversations: MutableMap<String, Conversation> = mutableMapOf()

    override fun definition() = ModuleDefinition {
        Name("XMTP")
        Events("sign", "authed", "conversation", "message")

        Function("address") { ->
            if (client != null) {
                client!!.address
            } else {
                "No Client."
            }
        }

        //
        // Auth fucntions
        //
        Function("auth") { address: String ->
            val reactSigner = ReactNativeSigner(module = this@XMTPModule, address = address)
            signer = reactSigner
            client = Client().create(account = reactSigner)
            signer = null
            sendEvent("authed")
        }
        Function("receiveSignature") { requestID: String, signature: String ->
            signer?.handle(id = requestID, signature = signature)
        }
        // Generate a random wallet and set the client to that
        Function("createRandom") { ->
            val privateKey = PrivateKeyBuilder()
            val randomClient = Client().create(account = privateKey)
            client = randomClient
            randomClient.address
        }
        //
        // Client API
        Function("listConversations") { ->
            if (client == null) {
                throw XMTPException("No client")
            }
            val conversationList = client?.conversations?.list()
            conversationList?.map { conversation ->
                conversations[conversation.cacheKey] = conversation
                ConversationWrapper.encode(conversation)
            }
        }
        // TODO: Support pagination and conversation ID here, don't do a full lookup each time
        Function("loadMessages") { conversationTopic: String, conversationId: String ->
            if (client == null) {
                throw XMTPException("No client")
            }
            val conversation =
                findConversation(topic = conversationTopic, conversationId = conversationId)
                    ?: throw XMTPException("no conversation found for $conversationTopic")
            conversation.messages(after = Date())
                .map { DecodedMessageWrapper.encode(it) }
        }
        // TODO: Support content types (?????)
        Function("sendMessage") { conversationTopic: String, conversationId: String, content: String ->
            if (client == null) {
                throw XMTPException("No client")
            }
            val conversation =
                findConversation(topic = conversationTopic, conversationId = conversationId)
                    ?: throw XMTPException("no conversation found for $conversationTopic")
            val preparedMessage = conversation.prepareMessage(content = content)
            val decodedMessage = preparedMessage.decodedMessage()
            preparedMessage.send()
            DecodedMessageWrapper.encode(decodedMessage)
        }
        // TODO: Support conversationId
        Function("createConversation") { peerAddress: String, conversationId: String ->
            if (client == null) {
                throw XMTPException("No client")
            }
            val conversation = client!!.conversations.newConversation(
                peerAddress,
                context = InvitationV1ContextBuilder.buildFromConversation(
                    conversationId = conversationId ?: "", metadata = mapOf()
                )
            )
            ConversationWrapper.encode(conversation)
        }
    }

    //
    // Helpers
    //
    fun findConversation(topic: String, conversationId: String?): Conversation? {
        if (client == null) {
            throw XMTPException("No client")
        }
        val cacheKey: String = if (conversationId != "") {
            "${topic}:${conversationId}"
        } else {
            topic
        }
        val cacheConversation = conversations[cacheKey]
        if (cacheConversation != null) {
            return cacheConversation
        } else {
            val conversation = client!!.conversations.list().firstOrNull { it.topic == topic && it.conversationId == conversationId }
            if (conversation != null) {
                conversations[conversation.cacheKey] = conversation
                return conversation
            }
        }
        return null
    }
}


