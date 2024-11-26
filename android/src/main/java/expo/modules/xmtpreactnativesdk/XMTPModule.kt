package expo.modules.xmtpreactnativesdk

import android.content.Context
import android.net.Uri
import android.util.Base64
import android.util.Base64.NO_WRAP
import android.util.Log
import androidx.core.net.toUri
import com.google.protobuf.kotlin.toByteString
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.xmtpreactnativesdk.wrappers.AuthParamsWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ClientWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ConsentWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ContentJson
import expo.modules.xmtpreactnativesdk.wrappers.ConversationWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ConversationParamsWrapper
import expo.modules.xmtpreactnativesdk.wrappers.CreateGroupParamsWrapper
import expo.modules.xmtpreactnativesdk.wrappers.DecodedMessageWrapper
import expo.modules.xmtpreactnativesdk.wrappers.DecryptedLocalAttachment
import expo.modules.xmtpreactnativesdk.wrappers.DmWrapper
import expo.modules.xmtpreactnativesdk.wrappers.EncryptedLocalAttachment
import expo.modules.xmtpreactnativesdk.wrappers.GroupWrapper
import expo.modules.xmtpreactnativesdk.wrappers.InboxStateWrapper
import expo.modules.xmtpreactnativesdk.wrappers.MemberWrapper
import expo.modules.xmtpreactnativesdk.wrappers.PermissionPolicySetWrapper
import expo.modules.xmtpreactnativesdk.wrappers.WalletParamsWrapper
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.xmtp.android.library.Client
import org.xmtp.android.library.ClientOptions
import org.xmtp.android.library.ConsentRecord
import org.xmtp.android.library.ConsentState
import org.xmtp.android.library.Conversation
import org.xmtp.android.library.Conversations.*
import org.xmtp.android.library.EntryType
import org.xmtp.android.library.PreEventCallback
import org.xmtp.android.library.SendOptions
import org.xmtp.android.library.SigningKey
import org.xmtp.android.library.WalletType
import org.xmtp.android.library.XMTPEnvironment
import org.xmtp.android.library.XMTPException
import org.xmtp.android.library.codecs.Attachment
import org.xmtp.android.library.codecs.AttachmentCodec
import org.xmtp.android.library.codecs.EncodedContent
import org.xmtp.android.library.codecs.EncryptedEncodedContent
import org.xmtp.android.library.codecs.RemoteAttachment
import org.xmtp.android.library.codecs.decoded
import org.xmtp.android.library.hexToByteArray
import org.xmtp.android.library.libxmtp.Message
import org.xmtp.android.library.messages.PrivateKeyBuilder
import org.xmtp.android.library.messages.Signature
import org.xmtp.android.library.push.Service
import org.xmtp.android.library.push.XMTPPush
import uniffi.xmtpv3.org.xmtp.android.library.libxmtp.GroupPermissionPreconfiguration
import uniffi.xmtpv3.org.xmtp.android.library.libxmtp.PermissionOption
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.util.UUID
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException


class ReactNativeSigner(
    var module: XMTPModule,
    override var address: String,
    override var type: WalletType = WalletType.EOA,
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

class XMTPModule : Module() {

    private val context: Context
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
        dbEncryptionKey: List<Int>,
        authParams: String,
        hasPreAuthenticateToInboxCallback: Boolean? = null,
    ): ClientOptions {
        if (hasPreAuthenticateToInboxCallback == true)
            preAuthenticateToInboxCallbackDeferred = CompletableDeferred()
        val preAuthenticateToInboxCallback: PreEventCallback? =
            preAuthenticateToInboxCallback.takeIf { hasPreAuthenticateToInboxCallback == true }
        val authOptions = AuthParamsWrapper.authParamsFromJson(authParams)
        val encryptionKeyBytes =
            dbEncryptionKey.foldIndexed(ByteArray(dbEncryptionKey.size)) { i, a, v ->
                a.apply { set(i, v.toByte()) }
            }
        val historySyncUrl = authOptions.historySyncUrl
            ?: when (authOptions.environment) {
                "production" -> "https://message-history.production.ephemera.network/"
                "local" -> "http://10.0.2.2:5558"
                else -> "https://message-history.dev.ephemera.network/"
            }
        return ClientOptions(
            api = apiEnvironments(authOptions.environment, authOptions.appVersion),
            preAuthenticateToInboxCallback = preAuthenticateToInboxCallback,
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
    private val subscriptions: MutableMap<String, Job> = mutableMapOf()
    private var preAuthenticateToInboxCallbackDeferred: CompletableDeferred<Unit>? = null


    override fun definition() = ModuleDefinition {
        Name("XMTP")
        Events(
            "sign",
            "authed",
            "preAuthenticateToInboxCallback",
            "conversation",
            "message",
            "conversationMessage",
            "consent",
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

        AsyncFunction("getInboxState") Coroutine { inboxId: String, refreshFromNetwork: Boolean ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val inboxState = client.inboxState(refreshFromNetwork)
                InboxStateWrapper.encode(inboxState)
            }
        }

        AsyncFunction("getInboxStates") Coroutine { inboxId: String, refreshFromNetwork: Boolean, inboxIds: List<String> ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val inboxStates = client.inboxStatesForInboxIds(refreshFromNetwork, inboxIds)
                inboxStates.map { InboxStateWrapper.encode(it) }
            }
        }

        Function("preAuthenticateToInboxCallbackCompleted") {
            logV("preAuthenticateToInboxCallbackCompleted")
            preAuthenticateToInboxCallbackDeferred?.complete(Unit)
        }

        //
        // Auth functions
        //
        Function("receiveSignature") { requestID: String, signature: String ->
            logV("receiveSignature")
            signer?.handle(id = requestID, signature = signature)
        }

        Function("receiveSCWSignature") { requestID: String, signature: String ->
            logV("receiveSCWSignature")
            signer?.handleSCW(id = requestID, signature = signature)
        }

        AsyncFunction("createRandom") Coroutine { hasPreAuthenticateToInboxCallback: Boolean?, dbEncryptionKey: List<Int>, authParams: String ->
            withContext(Dispatchers.IO) {
                logV("createRandom")
                val privateKey = PrivateKeyBuilder()
                val options = clientOptions(
                    dbEncryptionKey,
                    authParams,
                    hasPreAuthenticateToInboxCallback,
                )
                val randomClient = Client().create(account = privateKey, options = options)

                ContentJson.Companion
                clients[randomClient.inboxId] = randomClient
                ClientWrapper.encodeToObj(randomClient)
            }
        }

        AsyncFunction("create") Coroutine { address: String, hasAuthInboxCallback: Boolean?, dbEncryptionKey: List<Int>, authParams: String, walletParams: String ->
            withContext(Dispatchers.IO) {
                logV("create")
                val walletOptions = WalletParamsWrapper.walletParamsFromJson(walletParams)
                val reactSigner = ReactNativeSigner(
                    module = this@XMTPModule,
                    address = address,
                    type = walletOptions.walletType,
                    chainId = walletOptions.chainId,
                    blockNumber = walletOptions.blockNumber
                )
                signer = reactSigner
                val options = clientOptions(
                    dbEncryptionKey,
                    authParams,
                    hasAuthInboxCallback,
                )
                val client = Client().create(account = reactSigner, options = options)
                clients[client.inboxId] = client
                ContentJson.Companion
                signer = null
                sendEvent("authed", ClientWrapper.encodeToObj(client))
            }
        }

        AsyncFunction("build") Coroutine { address: String, dbEncryptionKey: List<Int>, authParams: String ->
            withContext(Dispatchers.IO) {
                logV("build")
                val options = clientOptions(
                    dbEncryptionKey,
                    authParams,
                )
                val client = Client().build(address = address, options = options)
                ContentJson.Companion
                clients[client.inboxId] = client
                ClientWrapper.encodeToObj(client)
            }
        }

        AsyncFunction("revokeAllOtherInstallations") Coroutine { inboxId: String, walletParams: String ->
            withContext(Dispatchers.IO) {
                logV("revokeAllOtherInstallations")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val walletOptions = WalletParamsWrapper.walletParamsFromJson(walletParams)
                val reactSigner =
                    ReactNativeSigner(
                        module = this@XMTPModule,
                        address = client.address,
                        type = walletOptions.walletType,
                        chainId = walletOptions.chainId,
                        blockNumber = walletOptions.blockNumber
                    )
                signer = reactSigner

                client.revokeAllOtherInstallations(reactSigner)
                signer = null
            }
        }

        AsyncFunction("addAccount") Coroutine { inboxId: String, newAddress: String, walletParams: String ->
            withContext(Dispatchers.IO) {
                logV("addAccount")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val walletOptions = WalletParamsWrapper.walletParamsFromJson(walletParams)
                val reactSigner =
                    ReactNativeSigner(
                        module = this@XMTPModule,
                        address = newAddress,
                        type = walletOptions.walletType,
                        chainId = walletOptions.chainId,
                        blockNumber = walletOptions.blockNumber
                    )
                signer = reactSigner

                client.addAccount(reactSigner)
                signer = null
            }
        }

        AsyncFunction("removeAccount") Coroutine { inboxId: String, addressToRemove: String, walletParams: String ->
            withContext(Dispatchers.IO) {
                logV("removeAccount")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val walletOptions = WalletParamsWrapper.walletParamsFromJson(walletParams)
                val reactSigner =
                    ReactNativeSigner(
                        module = this@XMTPModule,
                        address = client.address,
                        type = walletOptions.walletType,
                        chainId = walletOptions.chainId,
                        blockNumber = walletOptions.blockNumber
                    )
                signer = reactSigner

                client.removeAccount(reactSigner, addressToRemove)
                signer = null
            }
        }

        AsyncFunction("dropClient") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("dropClient")
                clients.remove(inboxId)
                Unit
            }
        }

        AsyncFunction("signWithInstallationKey") Coroutine { inboxId: String, message: String ->
            withContext(Dispatchers.IO) {
                logV("signWithInstallationKey")
                val client = clients[inboxId] ?: throw XMTPException("No client")

                val signature = client.signWithInstallationKey(message)
                signature.map { it.toInt() and 0xFF }
            }
        }

        AsyncFunction("verifySignature") Coroutine { inboxId: String, message: String, signature: List<Int> ->
            withContext(Dispatchers.IO) {
                logV("verifySignature")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val signatureBytes =
                    signature.foldIndexed(ByteArray(signature.size)) { i, a, v ->
                        a.apply { set(i, v.toByte()) }
                    }
                client.verifySignature(message, signatureBytes)
            }
        }

        AsyncFunction("canMessage") Coroutine { inboxId: String, peerAddresses: List<String> ->
            withContext(Dispatchers.IO) {
                logV("canMessage")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.canMessage(peerAddresses)
            }
        }

        AsyncFunction("getOrCreateInboxId") Coroutine { address: String, environment: String ->
            withContext(Dispatchers.IO) {
                try {
                    logV("getOrCreateInboxId")
                    Client.getOrCreateInboxId(
                        environment = apiEnvironments(environment, null),
                        address = address
                    )
                } catch (e: Exception) {
                    throw XMTPException("Failed to getOrCreateInboxId: ${e.message}")
                }
            }
        }

        AsyncFunction("encryptAttachment") { inboxId: String, fileJson: String ->
            logV("encryptAttachment")
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

        AsyncFunction("listGroups") Coroutine { inboxId: String, groupParams: String?, sortOrder: String?, limit: Int?, consentState: String? ->
            withContext(Dispatchers.IO) {
                logV("listGroups")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val params = ConversationParamsWrapper.conversationParamsFromJson(groupParams ?: "")
                val order = getConversationSortOrder(sortOrder ?: "")
                val consent = consentState?.let { getConsentState(it) }
                val groups = client.conversations.listGroups(
                    order = order,
                    limit = limit,
                    consentState = consent
                )
                groups.map { group ->
                    GroupWrapper.encode(client, group, params)
                }
            }
        }

        AsyncFunction("listDms") Coroutine { inboxId: String, groupParams: String?, sortOrder: String?, limit: Int?, consentState: String? ->
            withContext(Dispatchers.IO) {
                logV("listDms")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val params = ConversationParamsWrapper.conversationParamsFromJson(groupParams ?: "")
                val order = getConversationSortOrder(sortOrder ?: "")
                val consent = consentState?.let { getConsentState(it) }
                val dms = client.conversations.listDms(
                    order = order,
                    limit = limit,
                    consentState = consent
                )
                dms.map { dm ->
                    DmWrapper.encode(client, dm, params)
                }
            }
        }

        AsyncFunction("listConversations") Coroutine { inboxId: String, conversationParams: String?, sortOrder: String?, limit: Int?, consentState: String? ->
            withContext(Dispatchers.IO) {
                logV("listConversations")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val params =
                    ConversationParamsWrapper.conversationParamsFromJson(conversationParams ?: "")
                val order = getConversationSortOrder(sortOrder ?: "")
                val consent = consentState?.let { getConsentState(it) }
                val conversations =
                    client.conversations.list(order = order, limit = limit, consentState = consent)
                conversations.map { conversation ->
                    ConversationWrapper.encode(client, conversation, params)
                }
            }
        }

        AsyncFunction("conversationMessages") Coroutine { inboxId: String, conversationId: String, limit: Int?, beforeNs: Long?, afterNs: Long?, direction: String? ->
            withContext(Dispatchers.IO) {
                logV("conversationMessages")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversation(conversationId)
                conversation?.messages(
                    limit = limit,
                    beforeNs = beforeNs,
                    afterNs = afterNs,
                    direction = Message.SortDirection.valueOf(
                        direction ?: "DESCENDING"
                    )
                )?.map { DecodedMessageWrapper.encode(it) }
            }
        }

        AsyncFunction("findMessage") Coroutine { inboxId: String, messageId: String ->
            withContext(Dispatchers.IO) {
                logV("findMessage")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val message = client.findMessage(messageId)
                message?.let {
                    DecodedMessageWrapper.encode(it.decode())
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

        AsyncFunction("findConversation") Coroutine { inboxId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                logV("findConversation")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversation(conversationId)
                conversation?.let {
                    ConversationWrapper.encode(client, conversation)
                }
            }
        }

        AsyncFunction("findConversationByTopic") Coroutine { inboxId: String, topic: String ->
            withContext(Dispatchers.IO) {
                logV("findConversationByTopic")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversationByTopic(topic)
                conversation?.let {
                    ConversationWrapper.encode(client, conversation)
                }
            }
        }

        AsyncFunction("findDmByInboxId") Coroutine { inboxId: String, peerInboxId: String ->
            withContext(Dispatchers.IO) {
                logV("findDmByInboxId")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val dm = client.findDmByInboxId(peerInboxId)
                dm?.let {
                    DmWrapper.encode(client, dm)
                }
            }
        }

        AsyncFunction("findDmByAddress") Coroutine { inboxId: String, peerAddress: String ->
            withContext(Dispatchers.IO) {
                logV("findDmByAddress")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val dm = client.findDmByAddress(peerAddress)
                dm?.let {
                    DmWrapper.encode(client, dm)
                }
            }
        }

        AsyncFunction("sendMessage") Coroutine { inboxId: String, id: String, contentJson: String ->
            withContext(Dispatchers.IO) {
                logV("sendMessage")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversation(id)
                    ?: throw XMTPException("no conversation found for $id")
                val sending = ContentJson.fromJson(contentJson)
                conversation.send(
                    content = sending.content,
                    options = SendOptions(contentType = sending.type)
                )
            }
        }

        AsyncFunction("publishPreparedMessages") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("publishPreparedMessages")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversation(id)
                    ?: throw XMTPException("no conversation found for $id")
                conversation.publishMessages()
            }
        }

        AsyncFunction("prepareMessage") Coroutine { inboxId: String, id: String, contentJson: String ->
            withContext(Dispatchers.IO) {
                logV("prepareMessage")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversation(id)
                    ?: throw XMTPException("no conversation found for $id")
                val sending = ContentJson.fromJson(contentJson)
                conversation.prepareMessage(
                    content = sending.content,
                    options = SendOptions(contentType = sending.type)
                )
            }
        }

        AsyncFunction("findOrCreateDm") Coroutine { inboxId: String, peerAddress: String ->
            withContext(Dispatchers.IO) {
                logV("findOrCreateDm")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val dm = client.conversations.findOrCreateDm(peerAddress)
                DmWrapper.encode(client, dm)
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


        AsyncFunction("listMemberInboxIds") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("listMembers")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversation(id)
                    ?: throw XMTPException("no conversation found for $id")
                conversation.members().map { it.inboxId }
            }
        }

        AsyncFunction("dmPeerInboxId") Coroutine { inboxId: String, dmId: String ->
            withContext(Dispatchers.IO) {
                logV("dmPeerInboxId")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversation(dmId)
                    ?: throw XMTPException("no conversation found for $dmId")
                val dm = (conversation as Conversation.Dm).dm
                dm.peerInboxId
            }
        }

        AsyncFunction("listConversationMembers") Coroutine { inboxId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                logV("listConversationMembers")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversation(conversationId)
                    ?: throw XMTPException("no conversation found for $conversationId")
                conversation.members().map { MemberWrapper.encode(it) }
            }
        }

        AsyncFunction("syncConversations") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("syncConversations")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.conversations.sync()
            }
        }

        AsyncFunction("syncAllConversations") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("syncAllConversations")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val numGroupsSyncedInt: Int =
                    client.conversations.syncAllConversations().toInt()
                numGroupsSyncedInt
            }
        }

        AsyncFunction("syncConversation") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("syncConversation")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversation(id)
                    ?: throw XMTPException("no conversation found for $id")
                conversation.sync()
            }
        }

        AsyncFunction("addGroupMembers") Coroutine { inboxId: String, groupId: String, peerAddresses: List<String> ->
            withContext(Dispatchers.IO) {
                logV("addGroupMembers")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.addMembers(peerAddresses)
            }
        }

        AsyncFunction("removeGroupMembers") Coroutine { inboxId: String, groupId: String, peerAddresses: List<String> ->
            withContext(Dispatchers.IO) {
                logV("removeGroupMembers")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.removeMembers(peerAddresses)
            }
        }

        AsyncFunction("addGroupMembersByInboxId") Coroutine { inboxId: String, groupId: String, peerInboxIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("addGroupMembersByInboxId")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.addMembersByInboxId(peerInboxIds)
            }
        }

        AsyncFunction("removeGroupMembersByInboxId") Coroutine { inboxId: String, groupId: String, peerInboxIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("removeGroupMembersByInboxId")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.removeMembersByInboxId(peerInboxIds)
            }
        }

        AsyncFunction("groupName") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("groupName")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.name
            }
        }

        AsyncFunction("updateGroupName") Coroutine { inboxId: String, groupId: String, groupName: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupName")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateGroupName(groupName)
            }
        }

        AsyncFunction("groupImageUrlSquare") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("groupImageUrlSquare")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.imageUrlSquare
            }
        }

        AsyncFunction("updateGroupImageUrlSquare") Coroutine { inboxId: String, groupId: String, groupImageUrl: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupImageUrlSquare")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateGroupImageUrlSquare(groupImageUrl)
            }
        }

        AsyncFunction("groupDescription") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("groupDescription")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.description
            }
        }

        AsyncFunction("updateGroupDescription") Coroutine { inboxId: String, groupId: String, groupDescription: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupDescription")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateGroupDescription(groupDescription)
            }
        }

        AsyncFunction("groupPinnedFrameUrl") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("groupPinnedFrameUrl")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.pinnedFrameUrl
            }
        }

        AsyncFunction("updateGroupPinnedFrameUrl") Coroutine { inboxId: String, groupId: String, pinnedFrameUrl: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupPinnedFrameUrl")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateGroupPinnedFrameUrl(pinnedFrameUrl)
            }
        }

        AsyncFunction("isGroupActive") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("isGroupActive")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.isActive()
            }
        }

        AsyncFunction("addedByInboxId") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("addedByInboxId")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.addedByInboxId()
            }
        }

        AsyncFunction("creatorInboxId") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("creatorInboxId")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.creatorInboxId()
            }
        }

        AsyncFunction("isAdmin") Coroutine { clientInboxId: String, groupId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("isGroupAdmin")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.isAdmin(inboxId)
            }
        }

        AsyncFunction("isSuperAdmin") Coroutine { clientInboxId: String, groupId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("isSuperAdmin")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.isSuperAdmin(inboxId)
            }
        }

        AsyncFunction("listAdmins") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("listAdmins")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.listAdmins()
            }
        }

        AsyncFunction("listSuperAdmins") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("listSuperAdmins")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.listSuperAdmins()
            }
        }

        AsyncFunction("addAdmin") Coroutine { clientInboxId: String, groupId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("addAdmin")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.addAdmin(inboxId)
            }
        }

        AsyncFunction("addSuperAdmin") Coroutine { clientInboxId: String, groupId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("addSuperAdmin")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.addSuperAdmin(inboxId)
            }
        }

        AsyncFunction("removeAdmin") Coroutine { clientInboxId: String, groupId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("removeAdmin")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.removeAdmin(inboxId)
            }
        }

        AsyncFunction("removeSuperAdmin") Coroutine { clientInboxId: String, groupId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("removeSuperAdmin")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.removeSuperAdmin(inboxId)
            }
        }

        AsyncFunction("updateAddMemberPermission") Coroutine { clientInboxId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateAddMemberPermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateAddMemberPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateRemoveMemberPermission") Coroutine { clientInboxId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateRemoveMemberPermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateRemoveMemberPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateAddAdminPermission") Coroutine { clientInboxId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateAddAdminPermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateAddAdminPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateRemoveAdminPermission") Coroutine { clientInboxId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateRemoveAdminPermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateRemoveAdminPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateGroupNamePermission") Coroutine { clientInboxId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupNamePermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateGroupNamePermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateGroupImageUrlSquarePermission") Coroutine { clientInboxId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupImageUrlSquarePermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateGroupImageUrlSquarePermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateGroupDescriptionPermission") Coroutine { clientInboxId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupDescriptionPermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateGroupDescriptionPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateGroupPinnedFrameUrlPermission") Coroutine { clientInboxId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupPinnedFrameUrlPermission")
                val client = clients[clientInboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateGroupPinnedFrameUrlPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("permissionPolicySet") Coroutine { inboxId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("groupImageUrlSquare")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val group = client.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                val permissionPolicySet = group.permissionPolicySet()
                PermissionPolicySetWrapper.encodeToJsonString(permissionPolicySet)
            }
        }

        AsyncFunction("processMessage") Coroutine { inboxId: String, id: String, encryptedMessage: String ->
            withContext(Dispatchers.IO) {
                logV("processMessage")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversation(id)
                    ?: throw XMTPException("no conversation found for $id")
                val message = conversation.processMessage(Base64.decode(encryptedMessage, NO_WRAP))
                DecodedMessageWrapper.encode(message.decode())
            }
        }

        AsyncFunction("processWelcomeMessage") Coroutine { inboxId: String, encryptedMessage: String ->
            withContext(Dispatchers.IO) {
                logV("processWelcomeMessage")
                val client = clients[inboxId] ?: throw XMTPException("No client")

                val conversation =
                    client.conversations.fromWelcome(
                        Base64.decode(
                            encryptedMessage,
                            NO_WRAP
                        )
                    )
                ConversationWrapper.encode(client, conversation)
            }
        }

        AsyncFunction("syncConsent") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.preferences.syncConsent()
            }
        }

        AsyncFunction("setConsentState") Coroutine { inboxId: String, value: String, entryType: String, consentType: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                client.preferences.setConsentState(
                    listOf(
                        ConsentRecord(
                            value,
                            getEntryType(entryType),
                            getConsentState(consentType)
                        )
                    )
                )
            }
        }

        AsyncFunction("consentAddressState") Coroutine { inboxId: String, peerAddress: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                consentStateToString(client.preferences.addressState(peerAddress))
            }
        }

        AsyncFunction("consentInboxIdState") Coroutine { inboxId: String, peerInboxId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                consentStateToString(client.preferences.inboxIdState(peerInboxId))
            }
        }

        AsyncFunction("consentConversationIdState") Coroutine { inboxId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                consentStateToString(client.preferences.conversationState(conversationId))
            }
        }

        AsyncFunction("conversationConsentState") Coroutine { inboxId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversation(conversationId)
                    ?: throw XMTPException("no group found for $conversationId")
                consentStateToString(conversation.consentState())
            }
        }

        AsyncFunction("updateConversationConsent") Coroutine { inboxId: String, conversationId: String, state: String ->
            withContext(Dispatchers.IO) {
                logV("updateConversationConsent")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversation(conversationId)
                    ?: throw XMTPException("no group found for $conversationId")

                conversation.updateConsentState(getConsentState(state))
            }
        }

        Function("subscribeToConsent") { inboxId: String ->
            logV("subscribeToConsent")

            subscribeToConsent(inboxId = inboxId)
        }

        Function("subscribeToConversations") { inboxId: String, type: String ->
            logV("subscribeToConversations")

            subscribeToConversations(inboxId = inboxId, getStreamType(type))
        }

        Function("subscribeToAllMessages") { inboxId: String, type: String ->
            logV("subscribeToAllMessages")
            subscribeToAllMessages(inboxId = inboxId, getStreamType(type))
        }

        AsyncFunction("subscribeToMessages") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("subscribeToMessages")
                subscribeToMessages(
                    inboxId = inboxId,
                    id = id
                )
            }
        }

        Function("unsubscribeFromConsent") { inboxId: String ->
            logV("unsubscribeFromConsent")
            subscriptions[getConsentKey(inboxId)]?.cancel()
        }

        Function("unsubscribeFromConversations") { inboxId: String ->
            logV("unsubscribeFromConversations")
            subscriptions[getConversationsKey(inboxId)]?.cancel()
        }

        Function("unsubscribeFromAllMessages") { inboxId: String ->
            logV("unsubscribeFromAllMessages")
            subscriptions[getMessagesKey(inboxId)]?.cancel()
        }

        AsyncFunction("unsubscribeFromMessages") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("unsubscribeFromMessages")
                unsubscribeFromMessages(
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

        Function("subscribePushTopics") { topics: List<String> ->
            logV("subscribePushTopics")
            if (topics.isNotEmpty()) {
                if (xmtpPush == null) {
                    throw XMTPException("Push server not registered")
                }

                val subscriptions = topics.map {
                    Service.Subscription.newBuilder().also { sub ->
                        sub.topic = it
                    }.build()
                }

                xmtpPush?.subscribeWithMetadata(subscriptions)
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

        // FOR TESTING ONLY
        AsyncFunction("createRandomWalletKeyForLocalTesting") Coroutine { ->
            withContext(Dispatchers.IO) {
                val privateKeyBuilder = PrivateKeyBuilder()
                val privateKey = privateKeyBuilder.getPrivateKey().toByteArray()
                privateKey.map { it.toInt() and 0xFF }
            }
        }

        AsyncFunction("createForLocalTesting") Coroutine { dbEncryptionKey: List<Int>, authParams: String, walletKey: List<Int>? ->
            withContext(Dispatchers.IO) {
                logV("createForLocalTesting")
                val privateKey = if (walletKey != null) {
                    val walletKeyBytes = walletKey.foldIndexed(ByteArray(walletKey.size)) { i, a, v ->
                        a.apply { set(i, v.toByte()) }
                    }
                    val pk = PrivateKeyBuilder.buildFromPrivateKeyData(walletKeyBytes)
                    PrivateKeyBuilder(pk)
                } else {
                    PrivateKeyBuilder()
                }

                val authOptions = AuthParamsWrapper.authParamsFromJson(authParams)
                if (authOptions.environment != "local") throw XMTPException("Only enabled on local")
                val options = clientOptions(
                    dbEncryptionKey,
                    authParams,
                )
                val randomClient = Client().create(account = privateKey, options = options)

                ContentJson.Companion
                clients[randomClient.installationId] = randomClient
                clients[randomClient.inboxId] = randomClient
                ClientWrapper.encodeToObj(randomClient)
            }
        }

        AsyncFunction("localTestingSyncAllConversations") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                logV("localTestingSyncAllConversations")
                val client = clients[installationId] ?: throw XMTPException("No client")
                client.conversations.sync()
                val numGroupsSyncedInt: Int =
                    client.conversations.syncAllConversations().toInt()
                numGroupsSyncedInt
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

    private fun getStreamType(typeString: String): ConversationType {
        return when (typeString) {
            "groups" -> ConversationType.GROUPS
            "dms" -> ConversationType.DMS
            else -> ConversationType.ALL
        }
    }

    private fun getConsentState(stateString: String): ConsentState {
        return when (stateString) {
            "allowed" -> ConsentState.ALLOWED
            "denied" -> ConsentState.DENIED
            else -> ConsentState.UNKNOWN
        }
    }

    private fun getEntryType(entryString: String): EntryType {
        return when (entryString) {
            "address" -> EntryType.ADDRESS
            "conversation_id" -> EntryType.CONVERSATION_ID
            "inbox_id" -> EntryType.INBOX_ID
            else -> throw XMTPException("Invalid entry type: $entryString")
        }
    }

    private fun getConversationSortOrder(order: String): ConversationOrder {
        return when (order) {
            "lastMessage" -> ConversationOrder.LAST_MESSAGE
            else -> ConversationOrder.CREATED_AT
        }
    }

    private fun consentStateToString(state: ConsentState): String {
        return when (state) {
            ConsentState.ALLOWED -> "allowed"
            ConsentState.DENIED -> "denied"
            ConsentState.UNKNOWN -> "unknown"
        }
    }

    private fun subscribeToConsent(inboxId: String) {
        val client = clients[inboxId] ?: throw XMTPException("No client")

        subscriptions[getConsentKey(client.inboxId)]?.cancel()
        subscriptions[getConsentKey(client.inboxId)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    client.preferences.streamConsent().collect { consent ->
                        sendEvent(
                            "consent",
                            mapOf(
                                "inboxId" to inboxId,
                                "consent" to ConsentWrapper.encodeMap(consent)
                            )
                        )
                    }
                } catch (e: Exception) {
                    Log.e("XMTPModule", "Error in group subscription: $e")
                    subscriptions[getConsentKey(client.inboxId)]?.cancel()
                }
            }
    }

    private fun subscribeToConversations(inboxId: String, type: ConversationType) {
        val client = clients[inboxId] ?: throw XMTPException("No client")

        subscriptions[getConversationsKey(client.inboxId)]?.cancel()
        subscriptions[getConversationsKey(client.inboxId)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    client.conversations.stream(type).collect { conversation ->
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
                } catch (e: Exception) {
                    Log.e("XMTPModule", "Error in group subscription: $e")
                    subscriptions[getConversationsKey(client.inboxId)]?.cancel()
                }
            }
    }

    private fun subscribeToAllMessages(inboxId: String, type: ConversationType) {
        val client = clients[inboxId] ?: throw XMTPException("No client")

        subscriptions[getMessagesKey(inboxId)]?.cancel()
        subscriptions[getMessagesKey(inboxId)] = CoroutineScope(Dispatchers.IO).launch {
            try {
                client.conversations.streamAllMessages(type).collect { message ->
                    sendEvent(
                        "message",
                        mapOf(
                            "inboxId" to inboxId,
                            "message" to DecodedMessageWrapper.encodeMap(message),
                        )
                    )
                }
            } catch (e: Exception) {
                Log.e("XMTPModule", "Error in all group messages subscription: $e")
                subscriptions[getMessagesKey(inboxId)]?.cancel()
            }
        }
    }

    private suspend fun subscribeToMessages(inboxId: String, id: String) {
        val client = clients[inboxId] ?: throw XMTPException("No client")
        val conversation = client.findConversation(id)
            ?: throw XMTPException("no conversation found for $id")
        subscriptions[conversation.cacheKey(inboxId)]?.cancel()
        subscriptions[conversation.cacheKey(inboxId)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    conversation.streamMessages().collect { message ->
                        sendEvent(
                            "conversationMessage",
                            mapOf(
                                "inboxId" to inboxId,
                                "message" to DecodedMessageWrapper.encodeMap(message),
                                "conversationId" to id,
                            )
                        )
                    }
                } catch (e: Exception) {
                    Log.e("XMTPModule", "Error in messages subscription: $e")
                    subscriptions[conversation.cacheKey(inboxId)]?.cancel()
                }
            }
    }

    private fun getConsentKey(inboxId: String): String {
        return "consent:$inboxId"
    }

    private fun getMessagesKey(inboxId: String): String {
        return "messages:$inboxId"
    }

    private fun getConversationsKey(inboxId: String): String {
        return "conversations:$inboxId"
    }

    private fun unsubscribeFromMessages(
        inboxId: String,
        id: String,
    ) {
        val client = clients[inboxId] ?: throw XMTPException("No client")
        val convo = client.findConversation(id) ?: return
        subscriptions[convo.cacheKey(inboxId)]?.cancel()
    }

    private fun logV(msg: String) {
        if (isDebugEnabled) {
            Log.v("XMTPModule", msg)
        }
    }

    private val preAuthenticateToInboxCallback: suspend () -> Unit = {
        sendEvent("preAuthenticateToInboxCallback")
        preAuthenticateToInboxCallbackDeferred?.await()
        preAuthenticateToInboxCallbackDeferred = null
    }
}


