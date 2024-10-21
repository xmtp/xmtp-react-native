package expo.modules.xmtpreactnativesdk

import android.content.Context
import android.net.Uri
import android.util.Base64
import android.util.Base64.NO_WRAP
import android.util.Log
import androidx.core.net.toUri
import com.google.gson.JsonParser
import com.google.protobuf.kotlin.toByteString
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.xmtpreactnativesdk.wrappers.AuthParamsWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ClientWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ConsentWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ConsentWrapper.Companion.consentStateToString
import expo.modules.xmtpreactnativesdk.wrappers.ContentJson
import expo.modules.xmtpreactnativesdk.wrappers.ConversationContainerWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ConversationOrder
import expo.modules.xmtpreactnativesdk.wrappers.ConversationWrapper
import expo.modules.xmtpreactnativesdk.wrappers.CreateGroupParamsWrapper
import expo.modules.xmtpreactnativesdk.wrappers.DecodedMessageWrapper
import expo.modules.xmtpreactnativesdk.wrappers.DecryptedLocalAttachment
import expo.modules.xmtpreactnativesdk.wrappers.EncryptedLocalAttachment
import expo.modules.xmtpreactnativesdk.wrappers.GroupParamsWrapper
import expo.modules.xmtpreactnativesdk.wrappers.GroupWrapper
import expo.modules.xmtpreactnativesdk.wrappers.InboxStateWrapper
import expo.modules.xmtpreactnativesdk.wrappers.MemberWrapper
import expo.modules.xmtpreactnativesdk.wrappers.PermissionPolicySetWrapper
import expo.modules.xmtpreactnativesdk.wrappers.PreparedLocalMessage
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.web3j.utils.Numeric
import org.xmtp.android.library.Client
import org.xmtp.android.library.ClientOptions
import org.xmtp.android.library.ConsentState
import org.xmtp.android.library.Conversation
import org.xmtp.android.library.Group
import org.xmtp.android.library.PreEventCallback
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
import org.xmtp.android.library.hexToByteArray
import org.xmtp.android.library.messages.EnvelopeBuilder
import org.xmtp.android.library.messages.InvitationV1ContextBuilder
import org.xmtp.android.library.messages.MessageDeliveryStatus
import org.xmtp.android.library.messages.Pagination
import org.xmtp.android.library.messages.PrivateKeyBuilder
import org.xmtp.android.library.messages.Signature
import org.xmtp.android.library.messages.getPublicKeyBundle
import org.xmtp.android.library.push.Service
import org.xmtp.android.library.push.XMTPPush
import org.xmtp.proto.keystore.api.v1.Keystore.TopicMap.TopicData
import org.xmtp.proto.message.api.v1.MessageApiOuterClass
import org.xmtp.proto.message.contents.Invitation.ConsentProofPayload
import org.xmtp.proto.message.contents.PrivateKeyOuterClass
import uniffi.xmtpv3.org.xmtp.android.library.libxmtp.GroupPermissionPreconfiguration
import uniffi.xmtpv3.org.xmtp.android.library.libxmtp.InboxState
import uniffi.xmtpv3.org.xmtp.android.library.libxmtp.PermissionOption
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.util.Date
import java.util.UUID
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException


class ReactNativeSigner(
    var module: XMTPModule,
    override var address: String,
    override var isSmartContractWallet: Boolean = false,
    override var chainId: Long? = null,
    override var blockNumber: Long? = null,
) : SigningKey {
    private val continuations: MutableMap<String, Continuation<Signature>> = mutableMapOf()
    private val scwContinuations: MutableMap<String, Continuation<ByteArray>> = mutableMapOf()

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

    fun handleSCW(id: String, signature: String) {
        val continuation = scwContinuations[id] ?: return
        continuation.resume(signature.hexToByteArray())
        scwContinuations.remove(id)
    }

    override suspend fun signSCW(message: String): ByteArray {
        val request = SignatureRequest(message = message)
        module.sendEvent("sign", mapOf("id" to request.id, "message" to request.message))
        return suspendCancellableCoroutine { continuation ->
            scwContinuations[request.id] = continuation
        }
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

fun Conversation.cacheKey(inboxId: String): String {
    return "${inboxId}:${topic}"
}

fun Group.cacheKey(inboxId: String): String {
    return "${inboxId}:${id}"
}

class XMTPModule : Module() {

    val context: Context
        get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

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

    private fun clientOptions(
        dbEncryptionKey: List<Int>?,
        authParams: String,
        hasCreateIdentityCallback: Boolean? = null,
        hasEnableIdentityCallback: Boolean? = null,
        hasPreAuthenticateToInboxCallback: Boolean? = null,
    ): ClientOptions {
        if (hasCreateIdentityCallback == true)
            preCreateIdentityCallbackDeferred = CompletableDeferred()
        if (hasEnableIdentityCallback == true)
            preEnableIdentityCallbackDeferred = CompletableDeferred()
        if (hasPreAuthenticateToInboxCallback == true)
            preAuthenticateToInboxCallbackDeferred = CompletableDeferred()
        val preCreateIdentityCallback: PreEventCallback? =
            preCreateIdentityCallback.takeIf { hasCreateIdentityCallback == true }
        val preEnableIdentityCallback: PreEventCallback? =
            preEnableIdentityCallback.takeIf { hasEnableIdentityCallback == true }
        val preAuthenticateToInboxCallback: PreEventCallback? =
            preAuthenticateToInboxCallback.takeIf { hasPreAuthenticateToInboxCallback == true }

        val authOptions = AuthParamsWrapper.authParamsFromJson(authParams)
        val context = if (authOptions.enableV3) context else null
        val encryptionKeyBytes =
            dbEncryptionKey?.foldIndexed(ByteArray(dbEncryptionKey.size)) { i, a, v ->
                a.apply { set(i, v.toByte()) }
            }

        val historySyncUrl = authOptions.historySyncUrl
            ?: when (authOptions.environment) {
                "production" -> "https://message-history.production.ephemera.network/"
                "local" -> "http://0.0.0.0:5558"
                else -> "https://message-history.dev.ephemera.network/"
            }

        return ClientOptions(
            api = apiEnvironments(authOptions.environment, authOptions.appVersion),
            preCreateIdentityCallback = preCreateIdentityCallback,
            preEnableIdentityCallback = preEnableIdentityCallback,
            preAuthenticateToInboxCallback = preAuthenticateToInboxCallback,
            enableV3 = authOptions.enableV3,
            appContext = context,
            dbEncryptionKey = encryptionKeyBytes,
            dbDirectory = authOptions.dbDirectory,
            historySyncUrl = historySyncUrl
        )
    }

    private var clients: MutableMap<String, Client> = mutableMapOf()
    private var xmtpPush: XMTPPush? = null
    private var signer: ReactNativeSigner? = null
    private val isDebugEnabled = BuildConfig.DEBUG // TODO: consider making this configurable
    private val conversations: MutableMap<String, Conversation> = mutableMapOf()
    private val groups: MutableMap<String, Group> = mutableMapOf()
    private val subscriptions: MutableMap<String, Job> = mutableMapOf()
    private var preEnableIdentityCallbackDeferred: CompletableDeferred<Unit>? = null
    private var preCreateIdentityCallbackDeferred: CompletableDeferred<Unit>? = null
    private var preAuthenticateToInboxCallbackDeferred: CompletableDeferred<Unit>? = null


    override fun definition() = ModuleDefinition {
        Name("XMTP")
        Events(
            // Auth
            "sign",
            "authed",
            "authedV3",
            "preCreateIdentityCallback",
            "preEnableIdentityCallback",
            "preAuthenticateToInboxCallback",
            // Conversations
            "conversation",
            "group",
            "conversationContainer",
            "message",
            "allGroupMessage",
            // Conversation
            "conversationMessage",
            // Group
            "groupMessage",
        )

        Function("address") { inboxId: String ->
            logV("address")
            val client = clients[inboxId]
            client?.address ?: "No Client."
        }

        Function("inboxId") { inboxId: String ->
            logV("inboxId")
            val client = clients[inboxId]
            client?.inboxId ?: "No Client."
        }

        AsyncFunction("findInboxIdFromAddress") Coroutine { inboxId: String, address: String ->
            withContext(Dispatchers.IO) {
                logV("findInboxIdFromAddress")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.inboxIdFromAddress(address)
            }
        }

        AsyncFunction("deleteLocalDatabase") { inboxId: String ->
            logV(inboxId)
            logV(clients.toString())
            val client = clients[inboxId] ?: throw XMTPException("No client")
            client.deleteLocalDatabase()
        }

        Function("dropLocalDatabaseConnection") { inboxId: String ->
            val client = clients[inboxId] ?: throw XMTPException("No client")
            client.dropLocalDatabaseConnection()
        }

        AsyncFunction("reconnectLocalDatabase") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.reconnectLocalDatabase()
            }
        }

        AsyncFunction("requestMessageHistorySync") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.requestMessageHistorySync()
            }
        }

        AsyncFunction("revokeAllOtherInstallations") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("revokeAllOtherInstallations")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val reactSigner =
                    ReactNativeSigner(module = this@XMTPModule, address = client.address)
                signer = reactSigner

                client.revokeAllOtherInstallations(reactSigner)
                signer = null
            }
        }

        AsyncFunction("getInboxState") Coroutine { inboxId: String, refreshFromNetwork: Boolean ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val inboxState = client.inboxState(refreshFromNetwork)
                InboxStateWrapper.encode(inboxState)
            }
        }

        //
        // Auth functions
        //
        AsyncFunction("auth") Coroutine { address: String, hasCreateIdentityCallback: Boolean?, hasEnableIdentityCallback: Boolean?, hasAuthInboxCallback: Boolean?, dbEncryptionKey: List<Int>?, authParams: String ->
            withContext(Dispatchers.IO) {

                logV("auth")
                val reactSigner = ReactNativeSigner(module = this@XMTPModule, address = address)
                signer = reactSigner
                val options = clientOptions(
                    dbEncryptionKey,
                    authParams,
                    hasCreateIdentityCallback,
                    hasEnableIdentityCallback,
                    hasAuthInboxCallback,
                )
                val client = Client().create(account = reactSigner, options = options)
                clients[client.inboxId] = client
                ContentJson.Companion
                signer = null
                sendEvent("authed", ClientWrapper.encodeToObj(client))
            }
        }

        Function("receiveSignature") { requestID: String, signature: String ->
            logV("receiveSignature")
            signer?.handle(id = requestID, signature = signature)
        }

        Function("receiveSCWSignature") { requestID: String, signature: String ->
            logV("receiveSCWSignature")
            signer?.handleSCW(id = requestID, signature = signature)
        }

        // Generate a random wallet and set the client to that
        AsyncFunction("createRandom") Coroutine { hasCreateIdentityCallback: Boolean?, hasEnableIdentityCallback: Boolean?, hasPreAuthenticateToInboxCallback: Boolean?, dbEncryptionKey: List<Int>?, authParams: String ->
            withContext(Dispatchers.IO) {
                logV("createRandom")
                val privateKey = PrivateKeyBuilder()
                val options = clientOptions(
                    dbEncryptionKey,
                    authParams,
                    hasCreateIdentityCallback,
                    hasEnableIdentityCallback,
                    hasPreAuthenticateToInboxCallback,
                )
                val randomClient = Client().create(account = privateKey, options = options)

                ContentJson.Companion
                clients[randomClient.inboxId] = randomClient
                ClientWrapper.encodeToObj(randomClient)
            }
        }

        AsyncFunction("createFromKeyBundle") Coroutine { keyBundle: String, dbEncryptionKey: List<Int>?, authParams: String ->
            withContext(Dispatchers.IO) {
                logV("createFromKeyBundle")
                try {
                    val options = clientOptions(
                        dbEncryptionKey,
                        authParams
                    )
                    val bundle =
                        PrivateKeyOuterClass.PrivateKeyBundle.parseFrom(
                            Base64.decode(
                                keyBundle,
                                NO_WRAP
                            )
                        )
                    val client = Client().buildFromBundle(bundle = bundle, options = options)
                    ContentJson.Companion
                    clients[client.inboxId] = client
                    ClientWrapper.encodeToObj(client)
                } catch (e: Exception) {
                    throw XMTPException("Failed to create client: $e")
                }
            }
        }

        AsyncFunction("createV3") Coroutine { address: String, hasCreateIdentityCallback: Boolean?, hasEnableIdentityCallback: Boolean?, hasAuthInboxCallback: Boolean?, dbEncryptionKey: List<Int>?, authParams: String ->
            withContext(Dispatchers.IO) {
                logV("createV3")
                val authOptions = AuthParamsWrapper.authParamsFromJson(authParams)
                val reactSigner = ReactNativeSigner(
                    module = this@XMTPModule,
                    address = address,
                    isSmartContractWallet = authOptions.isSmartContractWallet,
                    chainId = authOptions.chainId,
                    blockNumber = authOptions.blockNumber
                )
                signer = reactSigner
                val options = clientOptions(
                    dbEncryptionKey,
                    authParams,
                    hasCreateIdentityCallback,
                    hasEnableIdentityCallback,
                    hasAuthInboxCallback,
                )
                val client = Client().createV3(account = reactSigner, options = options)
                clients[client.inboxId] = client
                ContentJson.Companion
                signer = null
                sendEvent("authedV3", ClientWrapper.encodeToObj(client))
            }
        }

        AsyncFunction("buildV3") Coroutine { address: String, dbEncryptionKey: List<Int>?, authParams: String ->
            withContext(Dispatchers.IO) {
                logV("buildV3")
                val authOptions = AuthParamsWrapper.authParamsFromJson(authParams)
                val options = clientOptions(
                    dbEncryptionKey,
                    authParams,
                )
                val client = Client().buildV3(address = address, chainId = authOptions.chainId, options = options)
                ContentJson.Companion
                clients[client.inboxId] = client
                ClientWrapper.encodeToObj(client)
            }
        }

        AsyncFunction("createRandomV3") Coroutine { hasCreateIdentityCallback: Boolean?, hasEnableIdentityCallback: Boolean?, hasPreAuthenticateToInboxCallback: Boolean?, dbEncryptionKey: List<Int>?, authParams: String ->
            withContext(Dispatchers.IO) {
                logV("createRandomV3")
                val privateKey = PrivateKeyBuilder()
                val options = clientOptions(
                    dbEncryptionKey,
                    authParams,
                    hasCreateIdentityCallback,
                    hasEnableIdentityCallback,
                    hasPreAuthenticateToInboxCallback,
                )
                val randomClient = Client().createV3(account = privateKey, options = options)

                ContentJson.Companion
                clients[randomClient.inboxId] = randomClient
                ClientWrapper.encodeToObj(randomClient)
            }
        }

        AsyncFunction("dropClient") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("dropClient")
                clients.remove(inboxId)
                Unit
            }
        }

        AsyncFunction("sign") Coroutine { inboxId: String, digest: List<Int>, keyType: String, preKeyIndex: Int ->
            withContext(Dispatchers.IO) {
                logV("sign")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val digestBytes =
                    digest.foldIndexed(ByteArray(digest.size)) { i, a, v ->
                        a.apply {
                            set(
                                i,
                                v.toByte()
                            )
                        }
                    }
                val privateKeyBundle = client.keys
                val signedPrivateKey = if (keyType == "prekey") {
                    privateKeyBundle.preKeysList[preKeyIndex]
                } else {
                    privateKeyBundle.identityKey
                }
                val privateKey = PrivateKeyBuilder.buildFromSignedPrivateKey(signedPrivateKey)
                val signature = PrivateKeyBuilder(privateKey).sign(digestBytes)
                signature.toByteArray().map { it.toInt() and 0xFF }
            }
        }

        AsyncFunction("exportPublicKeyBundle") { inboxId: String ->
            logV("exportPublicKeyBundle")
            val client = clients[inboxId] ?: throw XMTPException("No client")
            client.keys.getPublicKeyBundle().toByteArray().map { it.toInt() and 0xFF }
        }

        AsyncFunction("exportKeyBundle") { inboxId: String ->
            logV("exportKeyBundle")
            val client = clients[inboxId] ?: throw XMTPException("No client")
            Base64.encodeToString(client.privateKeyBundle.toByteArray(), NO_WRAP)
        }

        // Export the conversation's serialized topic data.
        AsyncFunction("exportConversationTopicData") Coroutine { inboxId: String, topic: String ->
            withContext(Dispatchers.IO) {
                logV("exportConversationTopicData")
                val conversation = findConversation(inboxId, topic)
                    ?: throw XMTPException("no conversation found for $topic")
                Base64.encodeToString(conversation.toTopicData().toByteArray(), NO_WRAP)
            }
        }

        AsyncFunction("getHmacKeys") { inboxId: String ->
            logV("getHmacKeys")
            val client = clients[inboxId] ?: throw XMTPException("No client")
            val hmacKeys = client.conversations.getHmacKeys()
            logV("$hmacKeys")
            hmacKeys.toByteArray().map { it.toInt() and 0xFF }
        }

        // Import a conversation from its serialized topic data.
        AsyncFunction("importConversationTopicData") { inboxId: String, topicData: String ->
            logV("importConversationTopicData")
            val client = clients[inboxId] ?: throw XMTPException("No client")
            val data = TopicData.parseFrom(Base64.decode(topicData, NO_WRAP))
            val conversation = client.conversations.importTopicData(data)
            conversations[conversation.cacheKey(inboxId)] = conversation
            if (conversation.keyMaterial == null) {
                logV("Null key material before encode conversation")
            }
            ConversationWrapper.encode(client, conversation)
        }

        //
        // Client API
        AsyncFunction("canMessage") Coroutine { inboxId: String, peerAddress: String ->
            withContext(Dispatchers.IO) {
                logV("canMessage")

                val client = clients[inboxId] ?: throw XMTPException("No client")

                client.canMessage(peerAddress)
            }
        }

        AsyncFunction("canGroupMessage") Coroutine { inboxId: String, peerAddresses: List<String> ->
            withContext(Dispatchers.IO) {
                logV("canGroupMessage")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.canMessageV3(peerAddresses)
            }
        }

        AsyncFunction("staticCanMessage") Coroutine { peerAddress: String, environment: String, appVersion: String? ->
            withContext(Dispatchers.IO) {
                try {
                    logV("staticCanMessage")
                    val options = ClientOptions(api = apiEnvironments(environment, appVersion))
                    Client.canMessage(peerAddress = peerAddress, options = options)
                } catch (e: Exception) {
                    throw XMTPException("Failed to create client: ${e.message}")
                }
            }
        }

        AsyncFunction("getOrCreateInboxId") Coroutine { address: String, environment: String ->
            withContext(Dispatchers.IO) {
                try {
                    logV("getOrCreateInboxId")
                    val options = ClientOptions(api = apiEnvironments(environment, null))
                    Client.getOrCreateInboxId(options = options, address = address)
                } catch (e: Exception) {
                    throw XMTPException("Failed to getOrCreateInboxId: ${e.message}")
                }
            }
        }

        AsyncFunction("encryptAttachment") { inboxId: String, fileJson: String ->
            logV("encryptAttachment")
            val client = clients[inboxId] ?: throw XMTPException("No client")
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

        AsyncFunction("decryptAttachment") { inboxId: String, encryptedFileJson: String ->
            logV("decryptAttachment")
            val client = clients[inboxId] ?: throw XMTPException("No client")
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

        AsyncFunction("sendEncodedContent") Coroutine { inboxId: String, topic: String, encodedContentData: List<Int> ->
            withContext(Dispatchers.IO) {
                val conversation =
                    findConversation(
                        inboxId = inboxId,
                        topic = topic
                    ) ?: throw XMTPException("no conversation found for $topic")

                val encodedContentDataBytes =
                    encodedContentData.foldIndexed(ByteArray(encodedContentData.size)) { i, a, v ->
                        a.apply {
                            set(
                                i,
                                v.toByte()
                            )
                        }
                    }
                val encodedContent = EncodedContent.parseFrom(encodedContentDataBytes)

                conversation.send(encodedContent = encodedContent)
            }
        }

        AsyncFunction("listConversations") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("listConversations")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversationList = client.conversations.list()
                conversationList.map { conversation ->
                    conversations[conversation.cacheKey(inboxId)] = conversation
                    if (conversation.keyMaterial == null) {
                        logV("Null key material before encode conversation")
                    }
                    ConversationWrapper.encode(client, conversation)
                }
            }
        }

        AsyncFunction("listGroups") Coroutine { inboxId: String, groupParams: String?, sortOrder: String?, limit: Int? ->
            withContext(Dispatchers.IO) {
                logV("listGroups")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val params = GroupParamsWrapper.groupParamsFromJson(groupParams ?: "")
                val order = getConversationSortOrder(sortOrder ?: "")
                val sortedGroupList = if (order == ConversationOrder.LAST_MESSAGE) {
                    client.conversations.listGroups()
                        .sortedByDescending { group ->
                            group.decryptedMessages(limit = 1).firstOrNull()?.sentAt
                        }
                        .let { groups ->
                            if (limit != null && limit > 0) groups.take(limit) else groups
                        }
                } else {
                    client.conversations.listGroups(limit = limit)
                }
                sortedGroupList.map { group ->
                    groups[group.cacheKey(inboxId)] = group
                    GroupWrapper.encode(client, group, params)
                }
            }
        }

        AsyncFunction("listAll") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversationContainerList = client.conversations.list(includeGroups = true)
                conversationContainerList.map { conversation ->
                    conversations[conversation.cacheKey(inboxId)] = conversation
                    ConversationContainerWrapper.encode(client, conversation)
                }
            }
        }

        AsyncFunction("loadMessages") Coroutine { inboxId: String, topic: String, limit: Int?, before: Long?, after: Long?, direction: String? ->
            withContext(Dispatchers.IO) {
                logV("loadMessages")
                val conversation =
                    findConversation(
                        inboxId = inboxId,
                        topic = topic,
                    ) ?: throw XMTPException("no conversation found for $topic")
                val beforeDate = if (before != null) Date(before) else null
                val afterDate = if (after != null) Date(after) else null

                conversation.decryptedMessages(
                    limit = limit,
                    before = beforeDate,
                    after = afterDate,
                    direction = MessageApiOuterClass.SortDirection.valueOf(
                        direction ?: "SORT_DIRECTION_DESCENDING"
                    )
                )
                    .map { DecodedMessageWrapper.encode(it) }
            }
        }

        AsyncFunction("groupMessages") Coroutine { inboxId: String, id: String, limit: Int?, before: Long?, after: Long?, direction: String?, deliveryStatus: String? ->
            withContext(Dispatchers.IO) {
                logV("groupMessages")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val beforeDate = if (before != null) Date(before) else null
                val afterDate = if (after != null) Date(after) else null
                val group = findGroup(inboxId, id)
                group?.decryptedMessages(
                    limit = limit,
                    before = beforeDate,
                    after = afterDate,
                    direction = MessageApiOuterClass.SortDirection.valueOf(
                        direction ?: "SORT_DIRECTION_DESCENDING"
                    ),
                    deliveryStatus = MessageDeliveryStatus.valueOf(
                        deliveryStatus ?: "ALL"
                    )
                )?.map { DecodedMessageWrapper.encode(it) }
            }
        }

        AsyncFunction("findV3Message") Coroutine { inboxId: String, messageId: String ->
            withContext(Dispatchers.IO) {
                logV("findV3Message")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val message = client.findMessage(messageId)
                message?.let {
                    DecodedMessageWrapper.encode(it.decrypt())
                }
            }
        }

        AsyncFunction("findGroup") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("findGroup")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                group?.let {
                    GroupWrapper.encode(client, it)
                }
            }
        }

        AsyncFunction("loadBatchMessages") Coroutine { inboxId: String, topics: List<String> ->
            withContext(Dispatchers.IO) {
                logV("loadBatchMessages")
                val client = clients[inboxId] ?: throw XMTPException("No client")
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

                client.conversations.listBatchDecryptedMessages(topicsList)
                    .map { DecodedMessageWrapper.encode(it) }
            }
        }

        AsyncFunction("sendMessage") Coroutine { inboxId: String, conversationTopic: String, contentJson: String ->
            withContext(Dispatchers.IO) {
                logV("sendMessage")
                val conversation =
                    findConversation(
                        inboxId = inboxId,
                        topic = conversationTopic
                    )
                        ?: throw XMTPException("no conversation found for $conversationTopic")
                val sending = ContentJson.fromJson(contentJson)
                conversation.send(
                    content = sending.content,
                    options = SendOptions(contentType = sending.type)
                )
            }
        }

        AsyncFunction("sendMessageToGroup") Coroutine { inboxId: String, id: String, contentJson: String ->
            withContext(Dispatchers.IO) {
                logV("sendMessageToGroup")
                val group =
                    findGroup(
                        inboxId = inboxId,
                        id = id
                    )
                        ?: throw XMTPException("no group found for $id")
                val sending = ContentJson.fromJson(contentJson)
                group.send(
                    content = sending.content,
                    options = SendOptions(contentType = sending.type)
                )
            }
        }

        AsyncFunction("publishPreparedGroupMessages") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("publishPreparedGroupMessages")
                val group =
                    findGroup(
                        inboxId = inboxId,
                        id = groupId
                    )
                        ?: throw XMTPException("no group found for $groupId")

                group.publishMessages()
            }
        }

        AsyncFunction("prepareGroupMessage") Coroutine { inboxId: String, id: String, contentJson: String ->
            withContext(Dispatchers.IO) {
                logV("prepareGroupMessage")
                val group =
                    findGroup(
                        inboxId = inboxId,
                        id = id
                    )
                        ?: throw XMTPException("no group found for $id")
                val sending = ContentJson.fromJson(contentJson)
                group.prepareMessage(
                    content = sending.content,
                    options = SendOptions(contentType = sending.type)
                )
            }
        }

        AsyncFunction("prepareMessage") Coroutine { inboxId: String, conversationTopic: String, contentJson: String ->
            withContext(Dispatchers.IO) {
                logV("prepareMessage")
                val conversation =
                    findConversation(
                        inboxId = inboxId,
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
        }

        AsyncFunction("prepareEncodedMessage") Coroutine { inboxId: String, conversationTopic: String, encodedContentData: List<Int> ->
            withContext(Dispatchers.IO) {
                logV("prepareEncodedMessage")
                val conversation =
                    findConversation(
                        inboxId = inboxId,
                        topic = conversationTopic
                    )
                        ?: throw XMTPException("no conversation found for $conversationTopic")

                val encodedContentDataBytes =
                    encodedContentData.foldIndexed(ByteArray(encodedContentData.size)) { i, a, v ->
                        a.apply {
                            set(
                                i,
                                v.toByte()
                            )
                        }
                    }
                val encodedContent = EncodedContent.parseFrom(encodedContentDataBytes)

                val prepared = conversation.prepareMessage(
                    encodedContent = encodedContent,
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
        }

        AsyncFunction("sendPreparedMessage") Coroutine { inboxId: String, preparedLocalMessageJson: String ->
            withContext(Dispatchers.IO) {
                logV("sendPreparedMessage")
                val client = clients[inboxId] ?: throw XMTPException("No client")
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
        }

        AsyncFunction("createConversation") Coroutine { inboxId: String, peerAddress: String, contextJson: String, consentProofPayload: List<Int> ->
            withContext(Dispatchers.IO) {
                logV("createConversation: $contextJson")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val context = JsonParser.parseString(contextJson).asJsonObject

                var consentProof: ConsentProofPayload? = null
                if (consentProofPayload.isNotEmpty()) {
                    val consentProofDataBytes =
                        consentProofPayload.foldIndexed(ByteArray(consentProofPayload.size)) { i, a, v ->
                            a.apply {
                                set(
                                    i,
                                    v.toByte()
                                )
                            }
                        }
                    consentProof = ConsentProofPayload.parseFrom(consentProofDataBytes)
                }

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
                                metadata.entrySet()
                                    .associate { (key, value) -> key to value.asString }
                            }

                            else -> mapOf()
                        },
                    ),
                    consentProof
                )
                if (conversation.keyMaterial == null) {
                    logV("Null key material before encode conversation")
                }
                if (conversation.consentProof == null) {
                    logV("Null consent before encode conversation")
                }
                ConversationWrapper.encode(client, conversation)
            }
        }
        AsyncFunction("createGroup") Coroutine { inboxId: String, peerAddresses: List<String>, permission: String, groupOptionsJson: String ->
            withContext(Dispatchers.IO) {
                logV("createGroup")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val permissionLevel = when (permission) {
                    "admin_only" -> GroupPermissionPreconfiguration.ADMIN_ONLY
                    else -> GroupPermissionPreconfiguration.ALL_MEMBERS
                }
                val createGroupParams =
                    CreateGroupParamsWrapper.createGroupParamsFromJson(groupOptionsJson)
                val group = client.conversations.newGroup(
                    peerAddresses,
                    permissionLevel,
                    createGroupParams.groupName,
                    createGroupParams.groupImageUrlSquare,
                    createGroupParams.groupDescription,
                    createGroupParams.groupPinnedFrameUrl
                )
                GroupWrapper.encode(client, group)
            }
        }

        AsyncFunction("createGroupCustomPermissions") Coroutine { inboxId: String, peerAddresses: List<String>, permissionPolicySetJson: String, groupOptionsJson: String ->
            withContext(Dispatchers.IO) {
                logV("createGroup")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val createGroupParams =
                    CreateGroupParamsWrapper.createGroupParamsFromJson(groupOptionsJson)
                val permissionPolicySet =
                    PermissionPolicySetWrapper.createPermissionPolicySetFromJson(
                        permissionPolicySetJson
                    )
                val group = client.conversations.newGroupCustomPermissions(
                    peerAddresses,
                    permissionPolicySet,
                    createGroupParams.groupName,
                    createGroupParams.groupImageUrlSquare,
                    createGroupParams.groupDescription,
                    createGroupParams.groupPinnedFrameUrl
                )
                GroupWrapper.encode(client, group)
            }
        }


        AsyncFunction("listMemberInboxIds") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("listMembers")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, groupId)
                group?.members()?.map { it.inboxId }
            }
        }

        AsyncFunction("listGroupMembers") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("listGroupMembers")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, groupId)
                group?.members()?.map { MemberWrapper.encode(it) }
            }
        }

        AsyncFunction("syncGroups") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("syncGroups")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.conversations.syncGroups()
            }
        }

        AsyncFunction("syncAllGroups") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("syncAllGroups")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.conversations.syncAllGroups()
                // Expo Modules do not support UInt, so we need to convert to Int
                val numGroupsSyncedInt: Int =
                    client.conversations.syncAllGroups()?.toInt() ?: throw IllegalArgumentException(
                        "Value cannot be null"
                    )
                numGroupsSyncedInt
            }
        }

        AsyncFunction("syncGroup") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("syncGroup")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)
                group?.sync()
            }
        }

        AsyncFunction("addGroupMembers") Coroutine { inboxId: String, id: String, peerAddresses: List<String> ->
            withContext(Dispatchers.IO) {
                logV("addGroupMembers")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.addMembers(peerAddresses)
            }
        }

        AsyncFunction("removeGroupMembers") Coroutine { inboxId: String, id: String, peerAddresses: List<String> ->
            withContext(Dispatchers.IO) {
                logV("removeGroupMembers")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.removeMembers(peerAddresses)
            }
        }

        AsyncFunction("addGroupMembersByInboxId") Coroutine { inboxId: String, id: String, peerInboxIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("addGroupMembersByInboxId")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.addMembersByInboxId(peerInboxIds)
            }
        }

        AsyncFunction("removeGroupMembersByInboxId") Coroutine { inboxId: String, id: String, peerInboxIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("removeGroupMembersByInboxId")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.removeMembersByInboxId(peerInboxIds)
            }
        }

        AsyncFunction("groupName") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("groupName")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.name
            }
        }

        AsyncFunction("updateGroupName") Coroutine { inboxId: String, id: String, groupName: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupName")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.updateGroupName(groupName)
            }
        }

        AsyncFunction("groupImageUrlSquare") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("groupImageUrlSquare")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.imageUrlSquare
            }
        }

        AsyncFunction("updateGroupImageUrlSquare") Coroutine { inboxId: String, id: String, groupImageUrl: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupImageUrlSquare")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.updateGroupImageUrlSquare(groupImageUrl)
            }
        }

        AsyncFunction("groupDescription") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("groupDescription")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.description
            }
        }

        AsyncFunction("updateGroupDescription") Coroutine { inboxId: String, id: String, groupDescription: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupDescription")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.updateGroupDescription(groupDescription)
            }
        }

        AsyncFunction("groupPinnedFrameUrl") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("groupPinnedFrameUrl")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.pinnedFrameUrl
            }
        }

        AsyncFunction("updateGroupPinnedFrameUrl") Coroutine { inboxId: String, id: String, pinnedFrameUrl: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupPinnedFrameUrl")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.updateGroupPinnedFrameUrl(pinnedFrameUrl)
            }
        }

        AsyncFunction("isGroupActive") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("isGroupActive")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.isActive()
            }
        }

        AsyncFunction("addedByInboxId") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("addedByInboxId")
                val group = findGroup(inboxId, id) ?: throw XMTPException("No group found")

                group.addedByInboxId()
            }
        }

        AsyncFunction("creatorInboxId") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("creatorInboxId")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.creatorInboxId()
            }
        }

        AsyncFunction("isAdmin") Coroutine { clientInboxId: String, id: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("isGroupAdmin")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)

                group?.isAdmin(inboxId)
            }
        }

        AsyncFunction("isSuperAdmin") Coroutine { clientInboxId: String, id: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("isSuperAdmin")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)

                group?.isSuperAdmin(inboxId)
            }
        }

        AsyncFunction("listAdmins") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("listAdmins")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.listAdmins()
            }
        }

        AsyncFunction("listSuperAdmins") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("listSuperAdmins")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                group?.listSuperAdmins()
            }
        }

        AsyncFunction("addAdmin") Coroutine { clientInboxId: String, id: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("addAdmin")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)
                group?.addAdmin(inboxId)
            }
        }

        AsyncFunction("addSuperAdmin") Coroutine { clientInboxId: String, id: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("addSuperAdmin")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)

                group?.addSuperAdmin(inboxId)
            }
        }

        AsyncFunction("removeAdmin") Coroutine { clientInboxId: String, id: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("removeAdmin")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)

                group?.removeAdmin(inboxId)
            }
        }

        AsyncFunction("removeSuperAdmin") Coroutine { clientInboxId: String, id: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("removeSuperAdmin")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)

                group?.removeSuperAdmin(inboxId)
            }
        }

        AsyncFunction("updateAddMemberPermission") Coroutine { clientInboxId: String, id: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateAddMemberPermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)

                group?.updateAddMemberPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateRemoveMemberPermission") Coroutine { clientInboxId: String, id: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateRemoveMemberPermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)

                group?.updateRemoveMemberPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateAddAdminPermission") Coroutine { clientInboxId: String, id: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateAddAdminPermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)

                group?.updateAddAdminPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateRemoveAdminPermission") Coroutine { clientInboxId: String, id: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateRemoveAdminPermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)

                group?.updateRemoveAdminPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateGroupNamePermission") Coroutine { clientInboxId: String, id: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupNamePermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)

                group?.updateGroupNamePermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateGroupImageUrlSquarePermission") Coroutine { clientInboxId: String, id: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupImageUrlSquarePermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)

                group?.updateGroupImageUrlSquarePermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateGroupDescriptionPermission") Coroutine { clientInboxId: String, id: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupDescriptionPermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)

                group?.updateGroupDescriptionPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateGroupPinnedFrameUrlPermission") Coroutine { clientInboxId: String, id: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupPinnedFrameUrlPermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = findGroup(clientInboxId, id)

                group?.updateGroupPinnedFrameUrlPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("permissionPolicySet") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("groupImageUrlSquare")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                val permissionPolicySet = group?.permissionPolicySet()
                if (permissionPolicySet != null) {
                    PermissionPolicySetWrapper.encodeToJsonString(permissionPolicySet)
                } else {
                    throw XMTPException("Permission policy set not found for group: $id")
                }
            }
        }

        AsyncFunction("processGroupMessage") Coroutine { inboxId: String, id: String, encryptedMessage: String ->
            withContext(Dispatchers.IO) {
                logV("processGroupMessage")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = findGroup(inboxId, id)

                val message = group?.processMessage(Base64.decode(encryptedMessage, NO_WRAP))
                    ?: throw XMTPException("could not decrypt message for $id")
                DecodedMessageWrapper.encodeMap(message.decrypt())
            }
        }

        AsyncFunction("processWelcomeMessage") Coroutine { inboxId: String, encryptedMessage: String ->
            withContext(Dispatchers.IO) {
                logV("processWelcomeMessage")
                val client = clients[inboxId] ?: throw XMTPException("No client")

                val group =
                    client.conversations.fromWelcome(Base64.decode(encryptedMessage, NO_WRAP))
                GroupWrapper.encode(client, group)
            }
        }

        Function("subscribeToConversations") { inboxId: String ->
            logV("subscribeToConversations")
            subscribeToConversations(inboxId = inboxId)
        }

        Function("subscribeToGroups") { inboxId: String ->
            logV("subscribeToGroups")
            subscribeToGroups(inboxId = inboxId)
        }

        Function("subscribeToAll") { inboxId: String ->
            logV("subscribeToAll")
            subscribeToAll(inboxId = inboxId)
        }

        Function("subscribeToAllMessages") { inboxId: String, includeGroups: Boolean ->
            logV("subscribeToAllMessages")
            subscribeToAllMessages(inboxId = inboxId, includeGroups = includeGroups)
        }

        Function("subscribeToAllGroupMessages") { inboxId: String ->
            logV("subscribeToAllGroupMessages")
            subscribeToAllGroupMessages(inboxId = inboxId)
        }

        AsyncFunction("subscribeToMessages") Coroutine { inboxId: String, topic: String ->
            withContext(Dispatchers.IO) {
                logV("subscribeToMessages")
                subscribeToMessages(
                    inboxId = inboxId,
                    topic = topic
                )
            }
        }

        AsyncFunction("subscribeToGroupMessages") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("subscribeToGroupMessages")
                subscribeToGroupMessages(
                    inboxId = inboxId,
                    id = id
                )
            }
        }

        Function("unsubscribeFromConversations") { inboxId: String ->
            logV("unsubscribeFromConversations")
            subscriptions[getConversationsKey(inboxId)]?.cancel()
        }

        Function("unsubscribeFromGroups") { inboxId: String ->
            logV("unsubscribeFromGroups")
            subscriptions[getGroupsKey(inboxId)]?.cancel()
        }

        Function("unsubscribeFromAllMessages") { inboxId: String ->
            logV("unsubscribeFromAllMessages")
            subscriptions[getMessagesKey(inboxId)]?.cancel()
        }

        Function("unsubscribeFromAllGroupMessages") { inboxId: String ->
            logV("unsubscribeFromAllGroupMessages")
            subscriptions[getGroupMessagesKey(inboxId)]?.cancel()
        }

        AsyncFunction("unsubscribeFromMessages") Coroutine { inboxId: String, topic: String ->
            withContext(Dispatchers.IO) {
                logV("unsubscribeFromMessages")
                unsubscribeFromMessages(
                    inboxId = inboxId,
                    topic = topic
                )
            }
        }

        AsyncFunction("unsubscribeFromGroupMessages") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("unsubscribeFromGroupMessages")
                unsubscribeFromGroupMessages(
                    inboxId = inboxId,
                    id = id
                )
            }
        }

        Function("registerPushToken") { pushServer: String, token: String ->
            logV("registerPushToken")
            xmtpPush = XMTPPush(appContext.reactContext!!, pushServer)
            xmtpPush?.register(token)
        }

        Function("subscribePushTopics") { inboxId: String, topics: List<String> ->
            logV("subscribePushTopics")
            if (topics.isNotEmpty()) {
                if (xmtpPush == null) {
                    throw XMTPException("Push server not registered")
                }
                val client = clients[inboxId] ?: throw XMTPException("No client")

                val hmacKeysResult = client.conversations.getHmacKeys()
                val subscriptions = topics.map {
                    val hmacKeys = hmacKeysResult.hmacKeysMap
                    val result = hmacKeys[it]?.valuesList?.map { hmacKey ->
                        Service.Subscription.HmacKey.newBuilder().also { sub_key ->
                            sub_key.key = hmacKey.hmacKey
                            sub_key.thirtyDayPeriodsSinceEpoch = hmacKey.thirtyDayPeriodsSinceEpoch
                        }.build()
                    }

                    Service.Subscription.newBuilder().also { sub ->
                        sub.addAllHmacKeys(result)
                        if (!result.isNullOrEmpty()) {
                            sub.addAllHmacKeys(result)
                        }
                        sub.topic = it
                    }.build()
                }

                xmtpPush?.subscribeWithMetadata(subscriptions)
            }
        }

        AsyncFunction("decodeMessage") Coroutine { inboxId: String, topic: String, encryptedMessage: String ->
            withContext(Dispatchers.IO) {
                logV("decodeMessage")
                val encryptedMessageData = Base64.decode(encryptedMessage, NO_WRAP)
                val envelope = EnvelopeBuilder.buildFromString(topic, Date(), encryptedMessageData)
                val conversation =
                    findConversation(
                        inboxId = inboxId,
                        topic = topic
                    )
                        ?: throw XMTPException("no conversation found for $topic")
                val decodedMessage = conversation.decrypt(envelope)
                DecodedMessageWrapper.encode(decodedMessage)
            }
        }

        AsyncFunction("isAllowed") Coroutine { inboxId: String, address: String ->
            withContext(Dispatchers.IO) {
                logV("isAllowed")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.contacts.isAllowed(address)
            }
        }

        AsyncFunction("isDenied") Coroutine { inboxId: String, address: String ->
            withContext(Dispatchers.IO) {
                logV("isDenied")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.contacts.isDenied(address)
            }
        }

        AsyncFunction("denyContacts") Coroutine { inboxId: String, addresses: List<String> ->
            withContext(Dispatchers.IO) {
                logV("denyContacts")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.contacts.deny(addresses)
            }
        }

        AsyncFunction("allowContacts") Coroutine { inboxId: String, addresses: List<String> ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.contacts.allow(addresses)
            }
        }

        AsyncFunction("isInboxAllowed") Coroutine { clientInboxId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("isInboxIdAllowed")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                client.contacts.isInboxAllowed(inboxId)
            }
        }

        AsyncFunction("isInboxDenied") Coroutine { clientInboxId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("isInboxIdDenied")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                client.contacts.isInboxDenied(inboxId)
            }
        }

        AsyncFunction("denyInboxes") Coroutine { inboxId: String, inboxIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("denyInboxIds")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.contacts.denyInboxes(inboxIds)
            }
        }

        AsyncFunction("allowInboxes") Coroutine { inboxId: String, inboxIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("allowInboxIds")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.contacts.allowInboxes(inboxIds)
            }
        }

        AsyncFunction("refreshConsentList") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val consentList = client.contacts.refreshConsentList()
                consentList.entries.map { ConsentWrapper.encode(it.value) }
            }
        }

        AsyncFunction("conversationConsentState") Coroutine { inboxId: String, conversationTopic: String ->
            withContext(Dispatchers.IO) {
                val conversation = findConversation(inboxId, conversationTopic)
                    ?: throw XMTPException("no conversation found for $conversationTopic")
                consentStateToString(conversation.consentState())
            }
        }

        AsyncFunction("groupConsentState") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                val group = findGroup(inboxId, groupId)
                    ?: throw XMTPException("no group found for $groupId")
                consentStateToString(group.consentState())
            }
        }

        AsyncFunction("consentList") { inboxId: String ->
            val client = clients[inboxId] ?: throw XMTPException("No client")
            client.contacts.consentList.entries.map { ConsentWrapper.encode(it.value) }
        }

        Function("preCreateIdentityCallbackCompleted") {
            logV("preCreateIdentityCallbackCompleted")
            preCreateIdentityCallbackDeferred?.complete(Unit)
        }

        Function("preEnableIdentityCallbackCompleted") {
            logV("preEnableIdentityCallbackCompleted")
            preEnableIdentityCallbackDeferred?.complete(Unit)
        }

        Function("preAuthenticateToInboxCallbackCompleted") {
            logV("preAuthenticateToInboxCallbackCompleted")
            preAuthenticateToInboxCallbackDeferred?.complete(Unit)
        }

        AsyncFunction("allowGroups") Coroutine { inboxId: String, groupIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("allowGroups")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.contacts.allowGroups(groupIds)
            }
        }

        AsyncFunction("denyGroups") Coroutine { inboxId: String, groupIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("denyGroups")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.contacts.denyGroups(groupIds)
            }
        }

        AsyncFunction("isGroupAllowed") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("isGroupAllowed")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.contacts.isGroupAllowed(groupId)
            }
        }
        AsyncFunction("isGroupDenied") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("isGroupDenied")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.contacts.isGroupDenied(groupId)
            }
        }
        AsyncFunction("updateGroupConsent") Coroutine { inboxId: String, groupId: String, state: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupConsent")
                val group = findGroup(inboxId, groupId)

                group?.updateConsentState(getConsentState(state))
            }
        }

        AsyncFunction("exportNativeLogs") Coroutine { ->
            withContext(Dispatchers.IO) {
                try {
                    val process = Runtime.getRuntime().exec("logcat -d")
                    val bufferedReader = BufferedReader(InputStreamReader(process.inputStream))

                    val log = StringBuilder()
                    var line: String?
                    while (bufferedReader.readLine().also { line = it } != null) {
                        log.append(line).append("\n")
                    }
                    log.toString()
                } catch (e: Exception) {
                    e.message
                }
            }
        }
    }

    //
    // Helpers
    //

    private fun getPermissionOption(permissionString: String): PermissionOption {
        return when (permissionString) {
            "allow" -> PermissionOption.Allow
            "deny" -> PermissionOption.Deny
            "admin" -> PermissionOption.Admin
            "super_admin" -> PermissionOption.SuperAdmin
            else -> throw XMTPException("Invalid permission option: $permissionString")
        }
    }

    private fun getConsentState(stateString: String): ConsentState {
        return when (stateString) {
            "allowed" -> ConsentState.ALLOWED
            "denied" -> ConsentState.DENIED
            else -> ConsentState.UNKNOWN
        }
    }

    private fun getConversationSortOrder(order: String): ConversationOrder {
        return when (order) {
            "lastMessage" -> ConversationOrder.LAST_MESSAGE
            else -> ConversationOrder.CREATED_AT
        }
    }

    private suspend fun findConversation(
        inboxId: String,
        topic: String,
    ): Conversation? {
        val client = clients[inboxId] ?: throw XMTPException("No client")

        val cacheKey = "${inboxId}:${topic}"
        val cacheConversation = conversations[cacheKey]
        if (cacheConversation != null) {
            return cacheConversation
        } else {
            val conversation = client.conversations.list()
                .firstOrNull { it.topic == topic }
            if (conversation != null) {
                conversations[conversation.cacheKey(inboxId)] = conversation
                return conversation
            }
        }
        return null
    }

    private fun findGroup(
        inboxId: String,
        id: String,
    ): Group? {
        val client = clients[inboxId] ?: throw XMTPException("No client")

        val cacheKey = "${inboxId}:${id}"
        val cacheGroup = groups[cacheKey]
        if (cacheGroup != null) {
            return cacheGroup
        } else {
            val group = client.findGroup(id)
            if (group != null) {
                groups[group.cacheKey(inboxId)] = group
                return group
            }
        }
        return null
    }

    private fun subscribeToConversations(inboxId: String) {
        val client = clients[inboxId] ?: throw XMTPException("No client")

        subscriptions[getConversationsKey(inboxId)]?.cancel()
        subscriptions[getConversationsKey(inboxId)] = CoroutineScope(Dispatchers.IO).launch {
            try {
                client.conversations.stream().collect { conversation ->
                    run {
                        if (conversation.keyMaterial == null) {
                            logV("Null key material before encode conversation")
                        }
                        sendEvent(
                            "conversation",
                            mapOf(
                                "inboxId" to inboxId,
                                "conversation" to ConversationWrapper.encodeToObj(
                                    client,
                                    conversation
                                )
                            )
                        )
                    }
                }
            } catch (e: Exception) {
                Log.e("XMTPModule", "Error in conversations subscription: $e")
                subscriptions[getConversationsKey(inboxId)]?.cancel()
            }
        }
    }

    private fun subscribeToGroups(inboxId: String) {
        val client = clients[inboxId] ?: throw XMTPException("No client")

        subscriptions[getGroupsKey(client.inboxId)]?.cancel()
        subscriptions[getGroupsKey(client.inboxId)] = CoroutineScope(Dispatchers.IO).launch {
            try {
                client.conversations.streamGroups().collect { group ->
                    sendEvent(
                        "group",
                        mapOf(
                            "inboxId" to inboxId,
                            "group" to GroupWrapper.encodeToObj(client, group)
                        )
                    )
                }
            } catch (e: Exception) {
                Log.e("XMTPModule", "Error in group subscription: $e")
                subscriptions[getGroupsKey(client.inboxId)]?.cancel()
            }
        }
    }

    private fun subscribeToAll(inboxId: String) {
        val client = clients[inboxId] ?: throw XMTPException("No client")

        subscriptions[getConversationsKey(inboxId)]?.cancel()
        subscriptions[getConversationsKey(inboxId)] = CoroutineScope(Dispatchers.IO).launch {
            try {
                client.conversations.streamAll().collect { conversation ->
                    sendEvent(
                        "conversationContainer",
                        mapOf(
                            "inboxId" to inboxId,
                            "conversationContainer" to ConversationContainerWrapper.encodeToObj(
                                client,
                                conversation
                            )
                        )
                    )
                }
            } catch (e: Exception) {
                Log.e("XMTPModule", "Error in subscription to groups + conversations: $e")
                subscriptions[getConversationsKey(inboxId)]?.cancel()
            }
        }
    }

    private fun subscribeToAllMessages(inboxId: String, includeGroups: Boolean = false) {
        val client = clients[inboxId] ?: throw XMTPException("No client")

        subscriptions[getMessagesKey(inboxId)]?.cancel()
        subscriptions[getMessagesKey(inboxId)] = CoroutineScope(Dispatchers.IO).launch {
            try {
                client.conversations.streamAllDecryptedMessages(includeGroups = includeGroups)
                    .collect { message ->
                        sendEvent(
                            "message",
                            mapOf(
                                "inboxId" to inboxId,
                                "message" to DecodedMessageWrapper.encodeMap(message),
                            )
                        )
                    }
            } catch (e: Exception) {
                Log.e("XMTPModule", "Error in all messages subscription: $e")
                subscriptions[getMessagesKey(inboxId)]?.cancel()
            }
        }
    }

    private fun subscribeToAllGroupMessages(inboxId: String) {
        val client = clients[inboxId] ?: throw XMTPException("No client")

        subscriptions[getGroupMessagesKey(inboxId)]?.cancel()
        subscriptions[getGroupMessagesKey(inboxId)] = CoroutineScope(Dispatchers.IO).launch {
            try {
                client.conversations.streamAllGroupDecryptedMessages().collect { message ->
                    sendEvent(
                        "allGroupMessage",
                        mapOf(
                            "inboxId" to inboxId,
                            "message" to DecodedMessageWrapper.encodeMap(message),
                        )
                    )
                }
            } catch (e: Exception) {
                Log.e("XMTPModule", "Error in all group messages subscription: $e")
                subscriptions[getGroupMessagesKey(inboxId)]?.cancel()
            }
        }
    }

    private suspend fun subscribeToMessages(inboxId: String, topic: String) {
        val conversation =
            findConversation(
                inboxId = inboxId,
                topic = topic
            ) ?: return
        subscriptions[conversation.cacheKey(inboxId)]?.cancel()
        subscriptions[conversation.cacheKey(inboxId)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    conversation.streamDecryptedMessages().collect { message ->
                        sendEvent(
                            "conversationMessage",
                            mapOf(
                                "inboxId" to inboxId,
                                "message" to DecodedMessageWrapper.encodeMap(message),
                                "topic" to topic,
                            )
                        )
                    }
                } catch (e: Exception) {
                    Log.e("XMTPModule", "Error in messages subscription: $e")
                    subscriptions[conversation.cacheKey(inboxId)]?.cancel()
                }
            }
    }

    private suspend fun subscribeToGroupMessages(inboxId: String, id: String) {
        val client = clients[inboxId] ?: throw XMTPException("No client")
        val group =
            findGroup(
                inboxId = inboxId,
                id = id
            ) ?: return
        subscriptions[group.cacheKey(inboxId)]?.cancel()
        subscriptions[group.cacheKey(inboxId)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    group.streamDecryptedMessages().collect { message ->
                        sendEvent(
                            "groupMessage",
                            mapOf(
                                "inboxId" to inboxId,
                                "message" to DecodedMessageWrapper.encodeMap(message),
                                "groupId" to id,
                            )
                        )
                    }
                } catch (e: Exception) {
                    Log.e("XMTPModule", "Error in messages subscription: $e")
                    subscriptions[group.cacheKey(inboxId)]?.cancel()
                }
            }
    }

    private fun getMessagesKey(inboxId: String): String {
        return "messages:$inboxId"
    }

    private fun getGroupMessagesKey(inboxId: String): String {
        return "groupMessages:$inboxId"
    }

    private fun getConversationsKey(inboxId: String): String {
        return "conversations:$inboxId"
    }

    private fun getGroupsKey(inboxId: String): String {
        return "groups:$inboxId"
    }

    private suspend fun unsubscribeFromMessages(
        inboxId: String,
        topic: String,
    ) {
        val conversation =
            findConversation(
                inboxId = inboxId,
                topic = topic
            ) ?: return
        subscriptions[conversation.cacheKey(inboxId)]?.cancel()
    }

    private suspend fun unsubscribeFromGroupMessages(
        inboxId: String,
        id: String,
    ) {
        val client = clients[inboxId] ?: throw XMTPException("No client")

        val group =
            findGroup(
                inboxId = inboxId,
                id = id
            ) ?: return
        subscriptions[group.cacheKey(inboxId)]?.cancel()
    }

    private fun logV(msg: String) {
        if (isDebugEnabled) {
            Log.v("XMTPModule", msg)
        }
    }

    private val preEnableIdentityCallback: suspend () -> Unit = {
        sendEvent("preEnableIdentityCallback")
        preEnableIdentityCallbackDeferred?.await()
        preCreateIdentityCallbackDeferred == null
    }

    private val preCreateIdentityCallback: suspend () -> Unit = {
        sendEvent("preCreateIdentityCallback")
        preCreateIdentityCallbackDeferred?.await()
        preCreateIdentityCallbackDeferred = null
    }

    private val preAuthenticateToInboxCallback: suspend () -> Unit = {
        sendEvent("preAuthenticateToInboxCallback")
        preAuthenticateToInboxCallbackDeferred?.await()
        preAuthenticateToInboxCallbackDeferred = null
    }
}


