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
import expo.modules.xmtpreactnativesdk.wrappers.ConsentWrapper.Companion.consentStateToString
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
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.xmtp.android.library.Client
import org.xmtp.android.library.ClientOptions
import org.xmtp.android.library.ConsentState
import org.xmtp.android.library.Conversation
import org.xmtp.android.library.Conversations.ConversationOrder
import org.xmtp.android.library.Dm
import org.xmtp.android.library.Group
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

fun Group.cacheKey(inboxId: String): String {
    return "${inboxId}:${id}"
}

fun Dm.cacheKey(inboxId: String): String {
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
                "local" -> "http://0.0.0.0:5558"
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
            // Auth
            "sign",
            "authed",
            "preAuthenticateToInboxCallback",
            "conversation",
            "allMessages",
            "message",
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
        Function("receiveSignature") { requestID: String, signature: String ->
            logV("receiveSignature")
            signer?.handle(id = requestID, signature = signature)
        }

        Function("receiveSCWSignature") { requestID: String, signature: String ->
            logV("receiveSCWSignature")
            signer?.handleSCW(id = requestID, signature = signature)
        }

        AsyncFunction("create") Coroutine { address: String, hasAuthInboxCallback: Boolean?, dbEncryptionKey: List<Int>, authParams: String ->
            withContext(Dispatchers.IO) {
                logV("create")
                val authOptions = AuthParamsWrapper.authParamsFromJson(authParams)
                val reactSigner = ReactNativeSigner(
                    module = this@XMTPModule,
                    address = address,
                    type = authOptions.walletType,
                    chainId = authOptions.chainId,
                    blockNumber = authOptions.blockNumber
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
                sendEvent("authedV3", ClientWrapper.encodeToObj(client))
            }
        }

        AsyncFunction("build") Coroutine { address: String, dbEncryptionKey: List<Int>, authParams: String ->
            withContext(Dispatchers.IO) {
                logV("build")
                val authOptions = AuthParamsWrapper.authParamsFromJson(authParams)
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

        AsyncFunction("dropClient") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("dropClient")
                clients.remove(inboxId)
                Unit
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

        AsyncFunction("listGroups") Coroutine { inboxId: String, groupParams: String?, sortOrder: String?, limit: Int? ->
            withContext(Dispatchers.IO) {
                logV("listGroups")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val params = ConversationParamsWrapper.conversationParamsFromJson(groupParams ?: "")
                val order = getConversationSortOrder(sortOrder ?: "")
                val sortedGroupList = if (order == ConversationOrder.LAST_MESSAGE) {
                    client.conversations.listGroups()
                        .sortedByDescending { group ->
                            group.messages(limit = 1).firstOrNull()?.sent
                        }
                        .let { groups ->
                            if (limit != null && limit > 0) groups.take(limit) else groups
                        }
                } else {
                    client.conversations.listGroups(limit = limit)
                }
                sortedGroupList.map { group ->
                    GroupWrapper.encode(client, group, params)
                }
            }
        }

        AsyncFunction("listConversations") Coroutine { inboxId: String, conversationParams: String?, sortOrder: String?, limit: Int? ->
            withContext(Dispatchers.IO) {
                logV("listConversations")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val params =
                    ConversationParamsWrapper.conversationParamsFromJson(conversationParams ?: "")
                val order = getConversationSortOrder(sortOrder ?: "")
                val conversations =
                    client.conversations.list(order = order, limit = limit)
                conversations.map { conversation ->
                    ConversationWrapper.encode(client, conversation, params)
                }
            }
        }

        AsyncFunction("listDms") Coroutine { inboxId: String, groupParams: String?, sortOrder: String?, limit: Int? ->
            withContext(Dispatchers.IO) {
                logV("listDms")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val params = ConversationParamsWrapper.conversationParamsFromJson(groupParams ?: "")
                val order = getConversationSortOrder(sortOrder ?: "")
                val sortedDmList = if (order == ConversationOrder.LAST_MESSAGE) {
                    client.conversations.listDms()
                        .sortedByDescending { dm ->
                            dm.messages(limit = 1).firstOrNull()?.sent
                        }
                        .let { dms ->
                            if (limit != null && limit > 0) dms.take(limit) else dms
                        }
                } else {
                    client.conversations.listDms(limit = limit)
                }
                sortedDmList.map { dm ->
                    DmWrapper.encode(client, dm, params)
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

        AsyncFunction("findDm") Coroutine { inboxId: String, peerAddress: String ->
            withContext(Dispatchers.IO) {
                logV("findDm")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val dm = client.findDm(peerAddress)
                dm?.let {
                    DmWrapper.encode(client, dm)
                }
            }
        }

        AsyncFunction("sendMessageToConversation") Coroutine { inboxId: String, id: String, contentJson: String ->
            withContext(Dispatchers.IO) {
                logV("sendMessageToConversation")
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

        AsyncFunction("findOrCreateDm") Coroutine { inboxId: String, peerAddress: String ->
            withContext(Dispatchers.IO) {
                logV("findOrCreateDm")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val dm = client.conversations.findOrCreateDm(peerAddress)
                DmWrapper.encode(client, dm)
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
                val permissionPolicySet = group?.permissionPolicySet()
                if (permissionPolicySet != null) {
                    PermissionPolicySetWrapper.encodeToJsonString(permissionPolicySet)
                } else {
                    throw XMTPException("Permission policy set not found for group: $groupId")
                }
            }
        }

        AsyncFunction("processMessage") Coroutine { inboxId: String, id: String, encryptedMessage: String ->
            withContext(Dispatchers.IO) {
                logV("processMessage")
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val conversation = client.findConversation(id)
                    ?: throw XMTPException("no conversation found for $id")
                val message = conversation.processMessage(Base64.decode(encryptedMessage, NO_WRAP))
                DecodedMessageWrapper.encodeMap(message.decode())
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

                val subscriptions = topics.map {
                    Service.Subscription.newBuilder().also { sub ->
                        sub.topic = it
                    }.build()
                }

                xmtpPush?.subscribeWithMetadata(subscriptions)
            }
        }

        AsyncFunction("setConsentState") Coroutine { inboxId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                val consentList = client.preferences.consentList.setConsentState()
            }
        }

        AsyncFunction("consentAddressState") Coroutine { inboxId: String, peerAddress: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                consentStateToString(client.preferences.consentList.addressState(peerAddress))
            }
        }

        AsyncFunction("consentInboxIdState") Coroutine { inboxId: String, peerInboxId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                consentStateToString(client.preferences.consentList.inboxIdState(peerInboxId))
            }
        }

        AsyncFunction("consentConversationIdState") Coroutine { inboxId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[inboxId] ?: throw XMTPException("No client")
                consentStateToString(client.preferences.consentList.conversationState(conversationId))
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

        Function("preAuthenticateToInboxCallbackCompleted") {
            logV("preAuthenticateToInboxCallbackCompleted")
            preAuthenticateToInboxCallbackDeferred?.complete(Unit)
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

        Function("subscribeToConversations") { inboxId: String, type: String ->
            logV("subscribeToConversations")

            subscribeToConversations(inboxId = inboxId, getStreamType(type))
        }

        Function("subscribeToAllMessages") { inboxId: String, type: String ->
            logV("subscribeToAllMessages")
            subscribeToAllMessages(inboxId = inboxId, getStreamType(type))
        }

        AsyncFunction("subscribeToConversationMessages") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("subscribeToConversationMessages")
                subscribeToConversationMessages(
                    inboxId = inboxId,
                    id = id
                )
            }
        }

        Function("unsubscribeFromAllMessages") { inboxId: String ->
            logV("unsubscribeFromAllMessages")
            subscriptions[getMessagesKey(inboxId)]?.cancel()
        }

        Function("unsubscribeFromConversations") { inboxId: String ->
            logV("unsubscribeFromConversations")
            subscriptions[getConversationsKey(inboxId)]?.cancel()
        }

        AsyncFunction("unsubscribeFromConversationMessages") Coroutine { inboxId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("unsubscribeFromConversationMessages")
                unsubscribeFromConversationMessages(
                    inboxId = inboxId,
                    id = id
                )
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
            "groups" -> GROUPS
            "dms" -> DMS
            else -> ALL
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
                        "allMessages",
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

    private suspend fun subscribeToConversationMessages(inboxId: String, id: String) {
        val client = clients[inboxId] ?: throw XMTPException("No client")
        val conversation = client.findConversation(id)
            ?: throw XMTPException("no conversation found for $id")
        subscriptions[conversation.cacheKey(inboxId)]?.cancel()
        subscriptions[conversation.cacheKey(inboxId)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    conversation.streamMessages().collect { message ->
                        sendEvent(
                            "message",
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

    private fun getMessagesKey(inboxId: String): String {
        return "messages:$inboxId"
    }

    private fun getConversationsKey(inboxId: String): String {
        return "conversations:$inboxId"
    }

    private fun unsubscribeFromConversationMessages(
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


