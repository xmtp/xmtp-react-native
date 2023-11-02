package expo.modules.xmtpreactnativesdk

import android.net.Uri
import android.util.Base64
import android.util.Base64.NO_WRAP
import android.util.Log
import androidx.core.net.toUri
import com.google.gson.JsonParser
import com.google.protobuf.kotlin.toByteString
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.xmtpreactnativesdk.wrappers.ContentJson
import expo.modules.xmtpreactnativesdk.wrappers.ConversationWrapper
import expo.modules.xmtpreactnativesdk.wrappers.DecodedMessageWrapper
import expo.modules.xmtpreactnativesdk.wrappers.DecryptedLocalAttachment
import expo.modules.xmtpreactnativesdk.wrappers.EncryptedLocalAttachment
import expo.modules.xmtpreactnativesdk.wrappers.PreparedLocalMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONObject
import org.xmtp.android.library.Client
import org.xmtp.android.library.ClientOptions
import org.xmtp.android.library.ConsentState
import org.xmtp.android.library.Conversation
import org.xmtp.android.library.PreparedMessage
import org.xmtp.android.library.SendOptions
import org.xmtp.android.library.SigningKey
import org.xmtp.android.library.XMTPEnvironment
import org.xmtp.android.library.XMTPException
import org.xmtp.android.library.codecs.Attachment
import org.xmtp.android.library.codecs.AttachmentCodec
import org.xmtp.android.library.codecs.EncodedContent
import org.xmtp.android.library.codecs.EncryptedEncodedContent
import org.xmtp.android.library.codecs.RemoteAttachment
import org.xmtp.android.library.codecs.decoded
import org.xmtp.android.library.messages.EnvelopeBuilder
import org.xmtp.android.library.messages.InvitationV1ContextBuilder
import org.xmtp.android.library.messages.Pagination
import org.xmtp.android.library.messages.PrivateKeyBuilder
import org.xmtp.android.library.messages.Signature
import org.xmtp.android.library.push.XMTPPush
import org.xmtp.proto.keystore.api.v1.Keystore.TopicMap.TopicData
import org.xmtp.proto.message.api.v1.MessageApiOuterClass
import org.xmtp.proto.message.contents.PrivateKeyOuterClass
import java.io.File
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
        val sig = Signature.newBuilder().also {
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
    return "${clientAddress}:${topic}"
}

class XMTPModule : Module() {
    private fun apiEnvironments(env: String, appVersion: String?): ClientOptions.Api {
        return when (env) {
            "local" -> ClientOptions.Api(
                env = XMTPEnvironment.LOCAL,
                isSecure = false,
                appVersion = appVersion
            )

            "production" -> ClientOptions.Api(
                env = XMTPEnvironment.PRODUCTION,
                isSecure = true,
                appVersion = appVersion
            )

            else -> ClientOptions.Api(
                env = XMTPEnvironment.DEV,
                isSecure = true,
                appVersion = appVersion
            )
        }
    }

    private var clients: MutableMap<String, Client> = mutableMapOf()
    private var xmtpPush: XMTPPush? = null
    private var signer: ReactNativeSigner? = null
    private val isDebugEnabled = BuildConfig.DEBUG // TODO: consider making this configurable
    private val conversations: MutableMap<String, Conversation> = mutableMapOf()
    private val subscriptions: MutableMap<String, Job> = mutableMapOf()

    override fun definition() = ModuleDefinition {
        Name("XMTP")
        Events("sign", "authed", "conversation", "message")

        Function("address") { clientAddress: String ->
            logV("address")
            val client = clients[clientAddress]
            client?.address ?: "No Client."
        }

        //
        // Auth functions
        //
        AsyncFunction("auth") { address: String, environment: String, appVersion: String? ->
            logV("auth")
            val reactSigner = ReactNativeSigner(module = this@XMTPModule, address = address)
            signer = reactSigner
            val options = ClientOptions(api = apiEnvironments(environment, appVersion))
            clients[address] = Client().create(account = reactSigner, options = options)
            signer = null
            sendEvent("authed")
        }

        Function("receiveSignature") { requestID: String, signature: String ->
            logV("receiveSignature")
            signer?.handle(id = requestID, signature = signature)
        }

        // Generate a random wallet and set the client to that
        AsyncFunction("createRandom") { environment: String, appVersion: String? ->
            logV("createRandom")
            val privateKey = PrivateKeyBuilder()
            val options = ClientOptions(api = apiEnvironments(environment, appVersion))
            val randomClient = Client().create(account = privateKey, options = options)
            clients[randomClient.address] = randomClient
            randomClient.address
        }

        AsyncFunction("createFromKeyBundle") { keyBundle: String, environment: String, appVersion: String? ->
            try {
                logV("createFromKeyBundle")
                val options = ClientOptions(api = apiEnvironments(environment, appVersion))
                val bundle =
                    PrivateKeyOuterClass.PrivateKeyBundle.parseFrom(
                        Base64.decode(
                            keyBundle,
                            NO_WRAP
                        )
                    )
                val client = Client().buildFromBundle(bundle = bundle, options = options)
                clients[client.address] = client
                client.address
            } catch (e: Exception) {
                throw XMTPException("Failed to create client: $e")
            }
        }

        AsyncFunction("exportKeyBundle") { clientAddress: String ->
            logV("exportKeyBundle")
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            Base64.encodeToString(client.privateKeyBundle.toByteArray(), NO_WRAP)
        }

        // Export the conversation's serialized topic data.
        AsyncFunction("exportConversationTopicData") { clientAddress: String, topic: String ->
            logV("exportConversationTopicData")
            val conversation = findConversation(clientAddress, topic)
                ?: throw XMTPException("no conversation found for $topic")
            Base64.encodeToString(conversation.toTopicData().toByteArray(), NO_WRAP)
        }

        // Import a conversation from its serialized topic data.
        AsyncFunction("importConversationTopicData") { clientAddress: String, topicData: String ->
            logV("importConversationTopicData")
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            val data = TopicData.parseFrom(Base64.decode(topicData, NO_WRAP))
            val conversation = client.conversations.importTopicData(data)
            conversations[conversation.cacheKey(clientAddress)] = conversation
            ConversationWrapper.encode(client, conversation)
        }

        //
        // Client API
        AsyncFunction("canMessage") { clientAddress: String, peerAddress: String ->
            logV("canMessage")
            val client = clients[clientAddress] ?: throw XMTPException("No client")

            client.canMessage(peerAddress)
        }

        AsyncFunction("encryptAttachment") { clientAddress: String, fileJson: String ->
            logV("encryptAttachment")
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            val file = DecryptedLocalAttachment.fromJson(fileJson)
            val uri = Uri.parse(file.fileUri)
            val data = appContext.reactContext?.contentResolver
                ?.openInputStream(uri)
                ?.use { it.buffered().readBytes() }!!
            val attachment = Attachment(
                filename = uri.lastPathSegment ?: "",
                mimeType = file.mimeType,
                data.toByteString(),
            )
            val encrypted = RemoteAttachment.encodeEncrypted(
                attachment,
                AttachmentCodec()
            )
            val encryptedFile = File.createTempFile(UUID.randomUUID().toString(), null)
            encryptedFile.writeBytes(encrypted.payload.toByteArray())

            EncryptedLocalAttachment.from(
                attachment,
                encrypted,
                encryptedFile.toUri()
            ).toJson()
        }

        AsyncFunction("decryptAttachment") { clientAddress: String, encryptedFileJson: String ->
            logV("decryptAttachment")
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            val encryptedFile = EncryptedLocalAttachment.fromJson(encryptedFileJson)
            val encryptedData = appContext.reactContext?.contentResolver
                ?.openInputStream(Uri.parse(encryptedFile.encryptedLocalFileUri))
                ?.use { it.buffered().readBytes() }!!
            val encrypted = EncryptedEncodedContent(
                encryptedFile.metadata.contentDigest,
                encryptedFile.metadata.secret,
                encryptedFile.metadata.salt,
                encryptedFile.metadata.nonce,
                encryptedData.toByteString(),
                encryptedData.size,
                encryptedFile.metadata.filename,
            )
            val encoded: EncodedContent = RemoteAttachment.decryptEncoded(encrypted)
            val attachment = encoded.decoded<Attachment>()!!
            val file = File.createTempFile(UUID.randomUUID().toString(), null)
            file.writeBytes(attachment.data.toByteArray())
            DecryptedLocalAttachment(
                fileUri = file.toURI().toString(),
                mimeType = attachment.mimeType,
                filename = attachment.filename
            ).toJson()
        }

        AsyncFunction("listConversations") { clientAddress: String ->
            logV("listConversations")
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            val conversationList = client.conversations.list()
            conversationList.map { conversation ->
                conversations[conversation.cacheKey(clientAddress)] = conversation
                ConversationWrapper.encode(client, conversation)
            }
        }

        AsyncFunction("loadMessages") { clientAddress: String, topic: String, limit: Int?, before: Long?, after: Long?, direction: String? ->
            logV("loadMessages")
            val conversation =
                findConversation(
                    clientAddress = clientAddress,
                    topic = topic,
                ) ?: throw XMTPException("no conversation found for $topic")
            val beforeDate = if (before != null) Date(before) else null
            val afterDate = if (after != null) Date(after) else null

            conversation.messages(
                limit = limit,
                before = beforeDate,
                after = afterDate,
                direction = MessageApiOuterClass.SortDirection.valueOf(
                    direction ?: "SORT_DIRECTION_DESCENDING"
                )
            )
                .map { DecodedMessageWrapper.encode(it) }
        }

        AsyncFunction("loadBatchMessages") { clientAddress: String, topics: List<String> ->
            logV("loadBatchMessages")
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            val topicsList = mutableListOf<Pair<String, Pagination>>()
            topics.forEach {
                val jsonObj = JSONObject(it)
                val topic = jsonObj.get("topic").toString()
                var limit: Int? = null
                var before: Long? = null
                var after: Long? = null
                var direction: MessageApiOuterClass.SortDirection =
                    MessageApiOuterClass.SortDirection.SORT_DIRECTION_DESCENDING

                try {
                    limit = jsonObj.get("limit").toString().toInt()
                    before = jsonObj.get("before").toString().toLong()
                    after = jsonObj.get("after").toString().toLong()
                    direction = MessageApiOuterClass.SortDirection.valueOf(
                        if (jsonObj.get("direction").toString().isNullOrBlank()) {
                            "SORT_DIRECTION_DESCENDING"
                        } else {
                            jsonObj.get("direction").toString()
                        }
                    )
                } catch (e: Exception) {
                    Log.e(
                        "XMTPModule",
                        "Pagination given incorrect information ${e.message}"
                    )
                }

                val page = Pagination(
                    limit = if (limit != null && limit > 0) limit else null,
                    before = if (before != null && before > 0) Date(before) else null,
                    after = if (after != null && after > 0) Date(after) else null,
                    direction = direction
                )

                topicsList.add(Pair(topic, page))
            }

            client.conversations.listBatchMessages(topicsList)
                .map { DecodedMessageWrapper.encode(it) }
        }

        AsyncFunction("sendMessage") { clientAddress: String, conversationTopic: String, contentJson: String ->
            logV("sendMessage")
            val conversation =
                findConversation(
                    clientAddress = clientAddress,
                    topic = conversationTopic
                )
                    ?: throw XMTPException("no conversation found for $conversationTopic")
            val sending = ContentJson.fromJson(contentJson)
            conversation.send(
                content = sending.content,
                options = SendOptions(
                    contentType = sending.type,
                    ephemeral = sending.ephemeral
                )
            )
        }

        AsyncFunction("prepareMessage") { clientAddress: String, conversationTopic: String, contentJson: String ->
            logV("prepareMessage")
            val conversation =
                findConversation(
                    clientAddress = clientAddress,
                    topic = conversationTopic
                )
                    ?: throw XMTPException("no conversation found for $conversationTopic")
            val sending = ContentJson.fromJson(contentJson)
            val prepared = conversation.prepareMessage(
                content = sending.content,
                options = SendOptions(contentType = sending.type)
            )
            val preparedAtMillis = prepared.envelopes[0].timestampNs / 1_000_000
            val preparedFile = File.createTempFile(prepared.messageId, null)
            preparedFile.writeBytes(prepared.toSerializedData())
            PreparedLocalMessage(
                messageId = prepared.messageId,
                preparedFileUri = preparedFile.toURI().toString(),
                preparedAt = preparedAtMillis,
            ).toJson()
        }

        AsyncFunction("sendPreparedMessage") { clientAddress: String, preparedLocalMessageJson: String ->
            logV("sendPreparedMessage")
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            val local = PreparedLocalMessage.fromJson(preparedLocalMessageJson)
            val preparedFileUrl = Uri.parse(local.preparedFileUri)
            val contentResolver = appContext.reactContext?.contentResolver!!
            val preparedData = contentResolver.openInputStream(preparedFileUrl)!!
                .use { it.buffered().readBytes() }
            val prepared = PreparedMessage.fromSerializedData(preparedData)
            client.publish(envelopes = prepared.envelopes)
            try {
                contentResolver.delete(preparedFileUrl, null, null)
            } catch (ignore: Exception) {
                /* ignore: the sending succeeds even if we fail to rm the tmp file afterward */
            }
            prepared.messageId
        }

        AsyncFunction("createConversation") { clientAddress: String, peerAddress: String, contextJson: String ->
            logV("createConversation: $contextJson")
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            val context = JsonParser.parseString(contextJson).asJsonObject
            val conversation = client.conversations.newConversation(
                peerAddress,
                context = InvitationV1ContextBuilder.buildFromConversation(
                    conversationId = when {
                        context.has("conversationID") -> context.get("conversationID").asString
                        else -> ""
                    },
                    metadata = when {
                        context.has("metadata") -> {
                            val metadata = context.get("metadata").asJsonObject
                            metadata.entrySet().associate { (key, value) -> key to value.asString }
                        }

                        else -> mapOf()
                    },
                )
            )
            ConversationWrapper.encode(client, conversation)
        }

        Function("subscribeToConversations") { clientAddress: String ->
            logV("subscribeToConversations")
            subscribeToConversations(clientAddress = clientAddress)
        }

        Function("subscribeToAllMessages") { clientAddress: String ->
            logV("subscribeToAllMessages")
            subscribeToAllMessages(clientAddress = clientAddress)
        }

        AsyncFunction("subscribeToMessages") { clientAddress: String, topic: String ->
            logV("subscribeToMessages")
            subscribeToMessages(
                clientAddress = clientAddress,
                topic = topic
            )
        }

        AsyncFunction("subscribeToEphemeralMessages") { clientAddress: String, topic: String ->
            logV("subscribeToEphemeralMessages")
            subscribeToEphemeralMessages(
                clientAddress = clientAddress,
                topic = topic
            )
        }

        Function("unsubscribeFromConversations") { clientAddress: String ->
            logV("unsubscribeFromConversations")
            subscriptions[getConversationsKey(clientAddress)]?.cancel()
        }

        Function("unsubscribeFromAllMessages") { clientAddress: String ->
            logV("unsubscribeFromAllMessages")
            subscriptions[getMessagesKey(clientAddress)]?.cancel()
        }

        AsyncFunction("unsubscribeFromMessages") { clientAddress: String, topic: String ->
            logV("unsubscribeFromMessages")
            unsubscribeFromMessages(
                clientAddress = clientAddress,
                topic = topic
            )
        }

        Function("registerPushToken") { pushServer: String, token: String ->
            logV("registerPushToken")
            xmtpPush = XMTPPush(appContext.reactContext!!, pushServer)
            xmtpPush?.register(token)
        }

        Function("subscribePushTopics") { topics: List<String> ->
            logV("subscribePushTopics")
            if (topics.isNotEmpty()) {
                if (xmtpPush == null) {
                    throw XMTPException("Push server not registered")
                }
                xmtpPush?.subscribe(topics)
            }
        }

        AsyncFunction("decodeMessage") { clientAddress: String, topic: String, encryptedMessage: String ->
            logV("decodeMessage")
            val encryptedMessageData = Base64.decode(encryptedMessage, NO_WRAP)
            val envelope = EnvelopeBuilder.buildFromString(topic, Date(), encryptedMessageData)
            val conversation =
                findConversation(
                    clientAddress = clientAddress,
                    topic = topic
                )
                    ?: throw XMTPException("no conversation found for $topic")
            val decodedMessage = conversation.decode(envelope)
            DecodedMessageWrapper.encode(decodedMessage)
        }

        AsyncFunction("isAllowed") { clientAddress: String, address: String ->
            logV("isAllowed")
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            client.contacts.isAllowed(address)
        }

        Function("isBlocked") { clientAddress: String, address: String ->
            logV("isBlocked")
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            client.contacts.isBlocked(address)
        }

        AsyncFunction("blockContacts") { clientAddress: String, addresses: List<String> ->
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            client.contacts.block(addresses)
        }

        AsyncFunction("allowContacts") { clientAddress: String, addresses: List<String> ->
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            client.contacts.allow(addresses)
        }

        AsyncFunction("refreshConsentList") { clientAddress: String ->
            val client = clients[clientAddress] ?: throw XMTPException("No client")
            client.contacts.refreshConsentList()
        }

        AsyncFunction("conversationConsentState") { clientAddress: String, conversationTopic: String ->
            val conversation = findConversation(clientAddress, conversationTopic)
                ?: throw XMTPException("no conversation found for $conversationTopic")
            when (conversation.consentState()) {
                ConsentState.ALLOWED -> "allowed"
                ConsentState.BLOCKED -> "blocked"
                ConsentState.UNKNOWN -> "unknown"
            }
        }
    }

    //
    // Helpers
    //
    private fun findConversation(
        clientAddress: String,
        topic: String,
    ): Conversation? {
        val client = clients[clientAddress] ?: throw XMTPException("No client")

        val cacheKey = "${clientAddress}:${topic}"
        val cacheConversation = conversations[cacheKey]
        if (cacheConversation != null) {
            return cacheConversation
        } else {
            val conversation = client.conversations.list()
                .firstOrNull { it.topic == topic }
            if (conversation != null) {
                conversations[conversation.cacheKey(clientAddress)] = conversation
                return conversation
            }
        }
        return null
    }

    private fun subscribeToConversations(clientAddress: String) {
        val client = clients[clientAddress] ?: throw XMTPException("No client")

        subscriptions[getConversationsKey(clientAddress)]?.cancel()
        subscriptions[getConversationsKey(clientAddress)] = CoroutineScope(Dispatchers.IO).launch {
            try {
                client.conversations.stream().collect { conversation ->
                    sendEvent(
                        "conversation",
                        mapOf(
                            "clientAddress" to clientAddress,
                            "conversation" to ConversationWrapper.encodeToObj(client, conversation)
                        )
                    )
                }
            } catch (e: Exception) {
                Log.e("XMTPModule", "Error in conversations subscription: $e")
                subscriptions[getConversationsKey(clientAddress)]?.cancel()
            }
        }
    }

    private fun subscribeToAllMessages(clientAddress: String) {
        val client = clients[clientAddress] ?: throw XMTPException("No client")

        subscriptions[getMessagesKey(clientAddress)]?.cancel()
        subscriptions[getMessagesKey(clientAddress)] = CoroutineScope(Dispatchers.IO).launch {
            try {
                client.conversations.streamAllMessages().collect { message ->
                    sendEvent(
                        "message",
                        mapOf(
                            "clientAddress" to clientAddress,
                            "message" to DecodedMessageWrapper.encodeMap(message),
                        )
                    )
                }
            } catch (e: Exception) {
                Log.e("XMTPModule", "Error in all messages subscription: $e")
                subscriptions[getMessagesKey(clientAddress)]?.cancel()
            }
        }
    }

    private fun subscribeToMessages(clientAddress: String, topic: String) {
        val conversation =
            findConversation(
                clientAddress = clientAddress,
                topic = topic
            ) ?: return
        subscriptions[conversation.cacheKey(clientAddress)]?.cancel()
        subscriptions[conversation.cacheKey(clientAddress)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    conversation.streamMessages().collect { message ->
                        sendEvent(
                            "message",
                            mapOf(
                                "clientAddress" to clientAddress,
                                "message" to DecodedMessageWrapper.encodeMap(message),
                            )
                        )
                    }
                } catch (e: Exception) {
                    Log.e("XMTPModule", "Error in messages subscription: $e")
                    subscriptions[conversation.cacheKey(clientAddress)]?.cancel()
                }
            }
    }

    private fun subscribeToEphemeralMessages(clientAddress: String, topic: String) {
        val conversation =
            findConversation(
                clientAddress = clientAddress,
                topic = topic
            ) ?: return
        subscriptions[conversation.cacheKey(clientAddress)]?.cancel()
        subscriptions[conversation.cacheKey(clientAddress)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    conversation.streamEphemeral().collect { envelope ->
                        sendEvent(
                            "message",
                            mapOf(
                                "clientAddress" to clientAddress,
                                "message" to DecodedMessageWrapper.encodeMap(conversation.decode(envelope))
                            )
                        )
                    }
                } catch (e: Exception) {
                    Log.e("XMTPModule", "Error in messages subscription: $e")
                    subscriptions[conversation.cacheKey(clientAddress)]?.cancel()
                }
            }
    }

    private fun getMessagesKey(clientAddress: String): String {
        return "messages:$clientAddress"
    }

    private fun getConversationsKey(clientAddress: String): String {
        return "conversations:$clientAddress"
    }

    private fun unsubscribeFromMessages(
        clientAddress: String,
        topic: String,
    ) {
        val conversation =
            findConversation(
                clientAddress = clientAddress,
                topic = topic
            ) ?: return
        subscriptions[conversation.cacheKey(clientAddress)]?.cancel()
    }

    private fun unsubscribeFromEphemeralMessages(
        clientAddress: String,
        topic: String,
    ) {
        val conversation =
            findConversation(
                clientAddress = clientAddress,
                topic = topic
            ) ?: return
        subscriptions[conversation.cacheKey(clientAddress)]?.cancel()
    }

    private fun logV(msg: String) {
        if (isDebugEnabled) {
            Log.v("XMTPModule", msg)
        }
    }
}


