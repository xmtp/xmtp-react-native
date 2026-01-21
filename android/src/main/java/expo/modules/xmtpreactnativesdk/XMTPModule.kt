package expo.modules.xmtpreactnativesdk

import android.content.Context
import android.content.SharedPreferences
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
import expo.modules.xmtpreactnativesdk.wrappers.ArchiveMetadataWrapper
import expo.modules.xmtpreactnativesdk.wrappers.AuthParamsWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ClientWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ConsentWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ContentJson
import expo.modules.xmtpreactnativesdk.wrappers.ConversationDebugInfoWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ConversationListParamsWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ConversationParamsWrapper
import expo.modules.xmtpreactnativesdk.wrappers.ConversationWrapper
import expo.modules.xmtpreactnativesdk.wrappers.CreateGroupParamsWrapper
import expo.modules.xmtpreactnativesdk.wrappers.DecryptedLocalAttachment
import expo.modules.xmtpreactnativesdk.wrappers.DisappearingMessageSettingsWrapper
import expo.modules.xmtpreactnativesdk.wrappers.DmWrapper
import expo.modules.xmtpreactnativesdk.wrappers.EncryptedLocalAttachment
import expo.modules.xmtpreactnativesdk.wrappers.GroupWrapper
import expo.modules.xmtpreactnativesdk.wrappers.InboxStateWrapper
import expo.modules.xmtpreactnativesdk.wrappers.KeyPackageStatusWrapper
import expo.modules.xmtpreactnativesdk.wrappers.MemberWrapper
import expo.modules.xmtpreactnativesdk.wrappers.MembershipResultWrapper
import expo.modules.xmtpreactnativesdk.wrappers.MessageQueryParamsWrapper
import expo.modules.xmtpreactnativesdk.wrappers.MessageWrapper
import expo.modules.xmtpreactnativesdk.wrappers.NetworkDebugInfoWrapper
import expo.modules.xmtpreactnativesdk.wrappers.PermissionPolicySetWrapper
import expo.modules.xmtpreactnativesdk.wrappers.PublicIdentityWrapper
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
import org.xmtp.android.library.Conversations
import org.xmtp.android.library.Conversations.ConversationFilterType
import org.xmtp.android.library.ForkRecoveryOptions
import org.xmtp.android.library.ForkRecoveryPolicy
import org.xmtp.android.library.PreEventCallback
import org.xmtp.android.library.PreferenceType
import org.xmtp.android.library.SendOptions
import org.xmtp.android.library.SignedData
import org.xmtp.android.library.SignerType
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
import org.xmtp.android.library.libxmtp.ArchiveElement
import org.xmtp.android.library.libxmtp.ArchiveOptions
import org.xmtp.android.library.libxmtp.DecodedMessage
import org.xmtp.android.library.libxmtp.DisappearingMessageSettings
import org.xmtp.android.library.libxmtp.GroupPermissionPreconfiguration
import org.xmtp.android.library.libxmtp.PermissionOption
import org.xmtp.android.library.libxmtp.PublicIdentity
import org.xmtp.android.library.libxmtp.SignatureRequest
import org.xmtp.android.library.MessageVisibilityOptions
import org.xmtp.android.library.messages.PrivateKeyBuilder
import org.xmtp.android.library.push.Service
import org.xmtp.android.library.push.XMTPPush
import uniffi.xmtpv3.FfiKeyPackageStatus
import uniffi.xmtpv3.FfiLogLevel
import uniffi.xmtpv3.FfiLogRotation
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.util.UUID
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException


class ReactNativeSigner(
    private val module: XMTPModule,
    override var publicIdentity: PublicIdentity,
    override var type: SignerType = SignerType.EOA,
    override var chainId: Long? = null,
    override var blockNumber: Long? = null,
) : SigningKey {
    private val continuations: MutableMap<String, Continuation<SignedData>> = mutableMapOf()

    fun handle(id: String, signature: String) {
        val continuation = continuations.remove(id) ?: return
        val signedData: SignedData

        when (this.type) {
            SignerType.EOA -> {
                val signatureData = Base64.decode(signature, Base64.NO_WRAP)
                if (signatureData.size != 65) {
                    continuation.resumeWithException(XMTPException("Invalid Signature"))
                    return
                }
                signedData = SignedData(
                    rawData = signatureData,
                    publicKey = publicIdentity.identifier.hexToByteArray(),
                    authenticatorData = null,
                    clientDataJson = null
                )
            }

            SignerType.SCW -> {
                signedData = SignedData(
                    rawData = signature.hexToByteArray(),
                    publicKey = publicIdentity.identifier.hexToByteArray(),
                    authenticatorData = null,
                    clientDataJson = null
                )
            }
        }

        continuation.resume(signedData)
    }

    override suspend fun sign(message: String): SignedData {
        val request = SignatureRequest(message = message)
        module.sendEvent("sign", mapOf("id" to request.id, "message" to request.message))

        return suspendCancellableCoroutine { continuation ->
            continuations[request.id] = continuation
        }
    }
}

data class SignatureRequest(
    var id: String = UUID.randomUUID().toString(),
    var message: String,
)

fun Conversation.cacheKey(installationId: String): String {
    return "${installationId}:${topic}"
}

fun getMessageDeletionsCacheKey(installationId: String): String {
    return "${installationId}:messageDeletions"
}

class XMTPModule : Module() {
    private val PREFS_NAME = "XMTPModulePrefs"
    private val LOG_WRITER_ACTIVE_KEY = "logWriterActive"
    private val LOG_LEVEL_KEY = "logLevel"
    private val LOG_ROTATION_KEY = "logRotation"
    private val LOG_MAX_FILES_KEY = "logMaxFiles"

    private val context: Context
        get() {
            val reactContext = appContext.reactContext
            if (reactContext == null) {
                logV("React context is null when attempting to access context")
                throw Exceptions.ReactContextLost()
            }
            return reactContext
        }

    private fun apiEnvironments(env: String, customLocalUrl: String? = null, appVersion: String? = null, gatewayHost: String? = null): ClientOptions.Api {
        return when (env) {
            "local" -> {
                if (customLocalUrl.isNullOrBlank()) {
                    ClientOptions.Api(
                        env = XMTPEnvironment.LOCAL,
                        isSecure = false,
                        appVersion = appVersion,
                        gatewayHost = gatewayHost,
                    )
                } else {
                    ClientOptions.Api(
                        env = XMTPEnvironment.LOCAL.withValue(customLocalUrl),
                        isSecure = false,
                        appVersion = appVersion,
                        gatewayHost = gatewayHost,
                    )
                }
            }

            "production" -> ClientOptions.Api(
                env = XMTPEnvironment.PRODUCTION,
                isSecure = true,
                appVersion = appVersion,
                gatewayHost = gatewayHost,
            )

            else -> ClientOptions.Api(
                env = XMTPEnvironment.DEV,
                isSecure = true,
                appVersion = appVersion,
                gatewayHost = gatewayHost,
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
            api = apiEnvironments(
                authOptions.environment,
                authOptions.customLocalUrl,
                authOptions.appVersion,
                authOptions.gatewayHost,
            ),
            preAuthenticateToInboxCallback = preAuthenticateToInboxCallback,
            appContext = context,
            dbEncryptionKey = encryptionKeyBytes,
            dbDirectory = authOptions.dbDirectory,
            historySyncUrl = historySyncUrl,
            deviceSyncEnabled = authOptions.deviceSyncEnabled,
            forkRecoveryOptions = authOptions.forkRecoveryOptions
        )
    }

    private var clients: MutableMap<String, Client> = mutableMapOf()
    private var xmtpPush: XMTPPush? = null
    private var signer: ReactNativeSigner? = null
    private val isDebugEnabled = BuildConfig.DEBUG // TODO: consider making this configurable
    private val subscriptions: MutableMap<String, Job> = mutableMapOf()
    private var preAuthenticateToInboxCallbackDeferred: CompletableDeferred<Unit>? = null
    private var clientSignatureRequests: MutableMap<String, SignatureRequest> =
        mutableMapOf()


    override fun definition() = ModuleDefinition {
        Name("XMTP")

        OnCreate {
            // This runs when the module is created AND the context is available
            logV("Module created with context available")
            // Check if logging should be activated on startup
            activateLogWriterIfEnabled()
        }

        Events(
            "sign",
            "authed",
            "preAuthenticateToInboxCallback",
            // Streams
            "conversation",
            "message",
            "conversationMessage",
            "consent",
            "preferences",
            "messageDeletion",
            // Streams Closed
            "conversationClosed",
            "messageClosed",
            "conversationMessageClosed",
            "consentClosed",
            "preferencesClosed",
            "messageDeletionClosed"
        )

        Function("inboxId") { installationId: String ->
            logV("inboxId")
            val client = clients[installationId]
            client?.inboxId ?: "No Client."
        }

        AsyncFunction("findInboxIdFromIdentity") Coroutine { installationId: String, publicIdentity: String ->
            withContext(Dispatchers.IO) {
                logV("findInboxIdFromIdentity")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val identity = PublicIdentityWrapper.publicIdentityFromJson(publicIdentity)
                client.inboxIdFromIdentity(identity)
            }
        }

        AsyncFunction("deleteLocalDatabase") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                logV(installationId)
                logV(clients.toString())
                val client = clients[installationId] ?: throw XMTPException("No client")
                client.deleteLocalDatabase()
            }
        }

        AsyncFunction("dropLocalDatabaseConnection") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                client.dropLocalDatabaseConnection()
            }
        }

        AsyncFunction("reconnectLocalDatabase") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                client.reconnectLocalDatabase()
            }
        }

        AsyncFunction("getInboxState") Coroutine { installationId: String, refreshFromNetwork: Boolean ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                val inboxState = client.inboxState(refreshFromNetwork)
                InboxStateWrapper.encode(inboxState)
            }
        }

        AsyncFunction("getInboxStates") Coroutine { installationId: String, refreshFromNetwork: Boolean, inboxIds: List<String> ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
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

        AsyncFunction("createRandom") Coroutine { hasPreAuthenticateToInboxCallback: Boolean?, dbEncryptionKey: List<Int>, authParams: String ->
            withContext(Dispatchers.IO) {
                logV("createRandom")
                val privateKey = PrivateKeyBuilder()
                val options = clientOptions(
                    dbEncryptionKey,
                    authParams,
                    hasPreAuthenticateToInboxCallback,
                )
                val randomClient =
                    Client.create(account = privateKey, options = options)

                ContentJson.Companion
                clients[randomClient.installationId] = randomClient
                ClientWrapper.encodeToObj(randomClient)
            }
        }

        AsyncFunction("create") Coroutine { publicIdentity: String, hasAuthInboxCallback: Boolean?, dbEncryptionKey: List<Int>, authParams: String, walletParams: String ->
            withContext(Dispatchers.IO) {
                logV("create")
                val walletOptions = WalletParamsWrapper.walletParamsFromJson(walletParams)
                val identity = PublicIdentityWrapper.publicIdentityFromJson(publicIdentity)

                val reactSigner = ReactNativeSigner(
                    module = this@XMTPModule,
                    publicIdentity = identity,
                    type = walletOptions.signerType,
                    chainId = walletOptions.chainId,
                    blockNumber = walletOptions.blockNumber
                )
                signer = reactSigner
                val options = clientOptions(
                    dbEncryptionKey,
                    authParams,
                    hasAuthInboxCallback,
                )
                val client =
                    Client.create(account = reactSigner, options = options)
                clients[client.installationId] = client
                ContentJson.Companion
                signer = null
                sendEvent("authed", ClientWrapper.encodeToObj(client))
            }
        }

        AsyncFunction("build") Coroutine { publicIdentity: String, inboxId: String?, dbEncryptionKey: List<Int>, authParams: String ->
            withContext(Dispatchers.IO) {
                logV("build")
                val options = clientOptions(
                    dbEncryptionKey,
                    authParams,
                )
                val identity = PublicIdentityWrapper.publicIdentityFromJson(publicIdentity)
                val client = Client.build(
                    publicIdentity = identity,
                    options = options,
                    inboxId = inboxId,
                )
                ContentJson.Companion
                clients[client.installationId] = client
                ClientWrapper.encodeToObj(client)
            }
        }

        AsyncFunction("ffiCreateClient") Coroutine { publicIdentity: String, dbEncryptionKey: List<Int>, authParams: String ->
            withContext(Dispatchers.IO) {
                logV("ffiCreateClient")
                val options = clientOptions(
                    dbEncryptionKey,
                    authParams,
                )
                val identity = PublicIdentityWrapper.publicIdentityFromJson(publicIdentity)
                val client = Client.ffiCreateClient(
                    publicIdentity = identity,
                    clientOptions = options,
                )
                ContentJson.Companion
                clients[client.installationId] = client
                ClientWrapper.encodeToObj(client)
            }
        }

        AsyncFunction("ffiCreateSignatureText") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                logV("ffiCreateSignatureText")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val sigRequest = client.ffiSignatureRequest()
                sigRequest?.let {
                    clientSignatureRequests[installationId] = it
                    it.signatureText()
                }
            }
        }

        AsyncFunction("ffiAddEcdsaSignature") Coroutine { installationId: String, signatureBytes: List<Int> ->
            withContext(Dispatchers.IO) {
                logV("ffiAddEcdsaSignature")
                val signature =
                    signatureBytes.foldIndexed(ByteArray(signatureBytes.size)) { i, a, v ->
                        a.apply { set(i, v.toByte()) }
                    }
                clientSignatureRequests[installationId]?.addEcdsaSignature(signature)
            }
        }

        AsyncFunction("ffiAddScwSignature") Coroutine { installationId: String, signatureBytes: List<Int>, address: String, chainId: Long, blockNumber: Long? ->
            withContext(Dispatchers.IO) {
                logV("ffiAddScwSignature")
                val signature =
                    signatureBytes.foldIndexed(ByteArray(signatureBytes.size)) { i, a, v ->
                        a.apply { set(i, v.toByte()) }
                    }
                clientSignatureRequests[installationId]?.addScwSignature(
                    signature,
                    address,
                    chainId.toULong(),
                    blockNumber?.toULong()
                )
            }
        }

        AsyncFunction("ffiRegisterIdentity") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                logV("ffiRegisterIdentity")
                val client = clients[installationId] ?: throw XMTPException("No client")
                clientSignatureRequests[installationId]?.let {
                    client.ffiRegisterIdentity(it)
                }
            }
        }

        AsyncFunction("revokeInstallations") Coroutine { installationId: String, walletParams: String, installationIds: List<String>, publicIdentity: String ->
            withContext(Dispatchers.IO) {
                logV("revokeInstallations")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val walletOptions = WalletParamsWrapper.walletParamsFromJson(walletParams)
                val identity = PublicIdentityWrapper.publicIdentityFromJson(publicIdentity)
                val reactSigner =
                    ReactNativeSigner(
                        module = this@XMTPModule,
                        publicIdentity = identity,
                        type = walletOptions.signerType,
                        chainId = walletOptions.chainId,
                        blockNumber = walletOptions.blockNumber
                    )
                signer = reactSigner

                client.revokeInstallations(reactSigner, installationIds)
                signer = null
            }
        }

        AsyncFunction("revokeAllOtherInstallations") Coroutine { installationId: String, walletParams: String, publicIdentity: String ->
            withContext(Dispatchers.IO) {
                logV("revokeAllOtherInstallations")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val walletOptions = WalletParamsWrapper.walletParamsFromJson(walletParams)
                val identity = PublicIdentityWrapper.publicIdentityFromJson(publicIdentity)
                val reactSigner =
                    ReactNativeSigner(
                        module = this@XMTPModule,
                        publicIdentity = identity,
                        type = walletOptions.signerType,
                        chainId = walletOptions.chainId,
                        blockNumber = walletOptions.blockNumber
                    )
                signer = reactSigner

                client.revokeAllOtherInstallations(reactSigner)
                signer = null
            }
        }

        AsyncFunction("addAccount") Coroutine { installationId: String, newIdentity: String, walletParams: String, allowReassignInboxId: Boolean ->
            withContext(Dispatchers.IO) {
                logV("addAccount")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val walletOptions = WalletParamsWrapper.walletParamsFromJson(walletParams)
                val identity = PublicIdentityWrapper.publicIdentityFromJson(newIdentity)
                val reactSigner =
                    ReactNativeSigner(
                        module = this@XMTPModule,
                        publicIdentity = identity,
                        type = walletOptions.signerType,
                        chainId = walletOptions.chainId,
                        blockNumber = walletOptions.blockNumber
                    )
                signer = reactSigner

                client.addAccount(reactSigner, allowReassignInboxId)
                signer = null
            }
        }

        AsyncFunction("removeAccount") Coroutine { installationId: String, identityToRemove: String, walletParams: String, publicIdentity: String ->
            withContext(Dispatchers.IO) {
                logV("removeAccount")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val walletOptions = WalletParamsWrapper.walletParamsFromJson(walletParams)
                val identity = PublicIdentityWrapper.publicIdentityFromJson(publicIdentity)
                val remove = PublicIdentityWrapper.publicIdentityFromJson(identityToRemove)

                val reactSigner =
                    ReactNativeSigner(
                        module = this@XMTPModule,
                        publicIdentity = identity,
                        type = walletOptions.signerType,
                        chainId = walletOptions.chainId,
                        blockNumber = walletOptions.blockNumber
                    )
                signer = reactSigner

                client.removeAccount(reactSigner, remove)
                signer = null
            }
        }

        AsyncFunction("ffiRevokeInstallationsSignatureText") Coroutine { installationId: String, installationIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("ffiRevokeInstallationsSignatureText")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val ids = installationIds.map { it.hexToByteArray() }
                val sigRequest = client.ffiRevokeInstallations(ids)
                sigRequest.let {
                    clientSignatureRequests[installationId] = it
                    it.signatureText()
                }
            }
        }

        AsyncFunction("ffiRevokeAllOtherInstallationsSignatureText") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                logV("ffiRevokeAllOtherInstallationsSignatureText")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val sigRequest = client.ffiRevokeAllOtherInstallations()
                sigRequest?.let {
                    clientSignatureRequests[installationId] = it
                    it.signatureText()
                }
            }
        }

        AsyncFunction("ffiRevokeWalletSignatureText") Coroutine { installationId: String, identityToRemove: String ->
            withContext(Dispatchers.IO) {
                logV("ffiRevokeWalletSignatureText")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val remove = PublicIdentityWrapper.publicIdentityFromJson(identityToRemove)
                val sigRequest = client.ffiRevokeIdentity(remove)
                sigRequest.let {
                    clientSignatureRequests[installationId] = it
                    it.signatureText()
                }
            }
        }

        AsyncFunction("ffiAddWalletSignatureText") Coroutine { installationId: String, newIdentity: String, allowReassignInboxId: Boolean ->
            withContext(Dispatchers.IO) {
                logV("ffiAddWalletSignatureText")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val identity = PublicIdentityWrapper.publicIdentityFromJson(newIdentity)
                val sigRequest = client.ffiAddIdentity(identity, allowReassignInboxId)
                sigRequest.let {
                    clientSignatureRequests[installationId] = it
                    it.signatureText()
                }
            }
        }

        AsyncFunction("ffiApplySignatureRequest") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                logV("ffiApplySignatureRequest")
                val client = clients[installationId] ?: throw XMTPException("No client")
                clientSignatureRequests[installationId]?.let {
                    client.ffiApplySignatureRequest(it)
                }
            }
        }

        AsyncFunction("dropClient") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                logV("dropClient")
                clients.remove(installationId)
                Unit
            }
        }

        AsyncFunction("signWithInstallationKey") Coroutine { installationId: String, message: String ->
            withContext(Dispatchers.IO) {
                logV("signWithInstallationKey")
                val client = clients[installationId] ?: throw XMTPException("No client")

                val signature = client.signWithInstallationKey(message)
                signature.map { it.toInt() and 0xFF }
            }
        }

        AsyncFunction("verifySignature") Coroutine { installationId: String, message: String, signature: List<Int> ->
            withContext(Dispatchers.IO) {
                logV("verifySignature")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val signatureBytes =
                    signature.foldIndexed(ByteArray(signature.size)) { i, a, v ->
                        a.apply { set(i, v.toByte()) }
                    }
                client.verifySignature(message, signatureBytes)
            }
        }

        AsyncFunction("canMessage") Coroutine { installationId: String, peerIdentities: List<String> ->
            withContext(Dispatchers.IO) {
                logV("canMessage")
                val identities =
                    peerIdentities.map { PublicIdentityWrapper.publicIdentityFromJson(it) }

                val client = clients[installationId] ?: throw XMTPException("No client")
                client.canMessage(identities)
            }
        }

        AsyncFunction("staticCanMessage") Coroutine { environment: String, peerIdentities: List<String> ->
            withContext(Dispatchers.IO) {
                logV("staticCanMessage")
                val identities =
                    peerIdentities.map { PublicIdentityWrapper.publicIdentityFromJson(it) }

                Client.canMessage(
                    identities,
                    apiEnvironments(environment),
                )
            }
        }

        AsyncFunction("staticInboxStatesForInboxIds") Coroutine { environment: String, inboxIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("staticInboxStatesForInboxIds")
                val inboxStates = Client.inboxStatesForInboxIds(
                    inboxIds,
                    apiEnvironments(environment),
                )
                inboxStates.map { InboxStateWrapper.encode(it) }
            }
        }

        AsyncFunction("staticRevokeInstallations") Coroutine { environment: String, publicIdentity: String, inboxId: String, walletParams: String, installationIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("staticRevokeInstallations")

                val walletOptions = WalletParamsWrapper.walletParamsFromJson(walletParams)
                val identity = PublicIdentityWrapper.publicIdentityFromJson(publicIdentity)

                val reactSigner = ReactNativeSigner(
                    module = this@XMTPModule,
                    publicIdentity = identity,
                    type = walletOptions.signerType,
                    chainId = walletOptions.chainId,
                    blockNumber = walletOptions.blockNumber
                )
                signer = reactSigner
                Client.revokeInstallations(
                    apiEnvironments(environment),
                    reactSigner,
                    inboxId,
                    installationIds
                )
                signer = null
            }
        }

        AsyncFunction("ffiStaticRevokeInstallationsSignatureText") Coroutine { environment: String, publicIdentity: String, inboxId: String, installationIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("ffiStaticRevokeInstallationsSignatureText")
                val identity = PublicIdentityWrapper.publicIdentityFromJson(publicIdentity)
                val sigRequest = Client.ffiRevokeInstallations(
                    apiEnvironments(environment),
                    identity,
                    inboxId,
                    installationIds
                )
                val type = SignatureType.REVOKE_INSTALLATIONS
                sigRequest.let {
                    clientSignatureRequests[type.typeName] = it
                    it.signatureText()
                }
            }
        }

        AsyncFunction("ffiStaticApplySignature") Coroutine { environment: String, signatureType: String ->
            withContext(Dispatchers.IO) {
                logV("ffiStaticApplySignature")
                clientSignatureRequests[signatureType]?.let {
                    Client.ffiApplySignatureRequest(apiEnvironments(environment), it)
                }

            }
        }

        AsyncFunction("ffiStaticAddEcdsaSignature") Coroutine { signatureType: String, signatureBytes: List<Int> ->
            withContext(Dispatchers.IO) {
                logV("ffiAddEcdsaSignature")
                val signature =
                    signatureBytes.foldIndexed(ByteArray(signatureBytes.size)) { i, a, v ->
                        a.apply { set(i, v.toByte()) }
                    }
                clientSignatureRequests[signatureType]?.addEcdsaSignature(signature)
            }
        }

        AsyncFunction("ffiStaticAddScwSignature") Coroutine { signatureType: String, signatureBytes: List<Int>, address: String, chainId: Long, blockNumber: Long? ->
            withContext(Dispatchers.IO) {
                logV("ffiAddScwSignature")
                val signature =
                    signatureBytes.foldIndexed(ByteArray(signatureBytes.size)) { i, a, v ->
                        a.apply { set(i, v.toByte()) }
                    }
                clientSignatureRequests[signatureType]?.addScwSignature(
                    signature,
                    address,
                    chainId.toULong(),
                    blockNumber?.toULong()
                )
            }
        }

        AsyncFunction("staticKeyPackageStatuses") Coroutine { environment: String, installationIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("staticKeyPackageStatuses")
                val keyPackageStatus: Map<String, FfiKeyPackageStatus> =
                    Client.keyPackageStatusesForInstallationIds(
                        installationIds,
                        apiEnvironments(environment),
                    )
                keyPackageStatus.mapValues { KeyPackageStatusWrapper.encode(it.value) }
            }
        }

        Function("staticActivatePersistentLibXMTPLogWriter") { logLevel: Int, logRotation: Int, maxFiles: Int ->
            logV("activateLogs")
            val ffiLogLevel = getFfiLogLevel(logLevel)
            val ffiLogRotation = getFfiLogRotation(logRotation)

            Client.activatePersistentLibXMTPLogWriter(
                context,
                ffiLogLevel,
                ffiLogRotation,
                maxFiles
            )

            // Save all settings
            setLogWriterActive(true)
            saveLogSettings(logLevel, logRotation, maxFiles)
        }

        Function("staticDeactivatePersistentLibXMTPLogWriter") {
            Client.deactivatePersistentLibXMTPLogWriter()
            // Save the state
            setLogWriterActive(false)
        }

        Function("getLogSettings") {
            mapOf(
                "active" to isLogWriterActive(),
                "logLevel" to getLogLevel(),
                "logRotation" to getLogRotation(),
                "maxFiles" to getLogMaxFiles()
            )
        }

        Function("isLogWriterActive") {
            isLogWriterActive()
        }

        Function("staticGetXMTPLogFilePaths") { ->
            Client.getXMTPLogFilePaths(context)
        }

        Function("staticClearXMTPLogs") { ->
            Client.clearXMTPLogs(context)
        }

        // Add a new function to read log file contents
        AsyncFunction("readXMTPLogFile") Coroutine { filePath: String ->
            withContext(Dispatchers.IO) {
                logV("readXMTPLogFile")
                try {
                    val file = File(filePath)
                    if (file.exists() && file.canRead()) {
                        file.readText()
                    } else {
                        "Cannot read file: $filePath (exists: ${file.exists()}, canRead: ${file.canRead()})"
                    }
                } catch (e: Exception) {
                    "Error reading log file: ${e.message}"
                }
            }
        }

        Function("unsubscribeFromConsent") { installationId: String ->
            logV("unsubscribeFromConsent")
            subscriptions[getConsentKey(installationId)]?.cancel()
        }

        Function("unsubscribeFromMessageDeletions") { installationId: String ->
            logV("unsubscribeFromMessageDeletions")
            subscriptions[getMessageDeletionsCacheKey(installationId)]?.cancel()
        }

        AsyncFunction("getOrCreateInboxId") Coroutine { publicIdentity: String, environment: String ->
            withContext(Dispatchers.IO) {
                try {
                    logV("getOrCreateInboxId")
                    val identity = PublicIdentityWrapper.publicIdentityFromJson(publicIdentity)
                    Client.getOrCreateInboxId(
                        api = apiEnvironments(environment),
                        identity
                    )
                } catch (e: Exception) {
                    throw XMTPException("Failed to getOrCreateInboxId: ${e.message}")
                }
            }
        }

        AsyncFunction("encryptAttachment") { installationId: String, fileJson: String ->
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

        AsyncFunction("decryptAttachment") { installationId: String, encryptedFileJson: String ->
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

        AsyncFunction("listGroups") Coroutine { installationId: String, groupParams: String?, queryParamsJson: String? ->
            withContext(Dispatchers.IO) {
                logV("listGroups")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val params = ConversationParamsWrapper.conversationParamsFromJson(groupParams ?: "")
                val queryParams = ConversationListParamsWrapper.conversationListParamsFromJson(queryParamsJson ?: "")
                val groups = client.conversations.listGroups(
                    createdAfterNs = queryParams.createdAfterNs,
                    createdBeforeNs = queryParams.createdBeforeNs,
                    lastActivityAfterNs = queryParams.lastActivityAfterNs,
                    lastActivityBeforeNs = queryParams.lastActivityBeforeNs,
                    limit = queryParams.limit,
                    consentStates = queryParams.consentStates,
                    orderBy = queryParams.orderBy ?: Conversations.ListConversationsOrderBy.LAST_ACTIVITY
                )
                groups.map { group ->
                    GroupWrapper.encode(client, group, params)
                }
            }
        }

        AsyncFunction("listDms") Coroutine { installationId: String, groupParams: String?, queryParamsJson: String? ->
            withContext(Dispatchers.IO) {
                logV("listDms")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val params = ConversationParamsWrapper.conversationParamsFromJson(groupParams ?: "")
                val queryParams = ConversationListParamsWrapper.conversationListParamsFromJson(queryParamsJson ?: "")
                val dms = client.conversations.listDms(
                    createdAfterNs = queryParams.createdAfterNs,
                    createdBeforeNs = queryParams.createdBeforeNs,
                    lastActivityAfterNs = queryParams.lastActivityAfterNs,
                    lastActivityBeforeNs = queryParams.lastActivityBeforeNs,
                    limit = queryParams.limit,
                    consentStates = queryParams.consentStates,
                    orderBy = queryParams.orderBy ?: Conversations.ListConversationsOrderBy.LAST_ACTIVITY
                )
                dms.map { dm ->
                    DmWrapper.encode(client, dm, params)
                }
            }
        }

        AsyncFunction("listConversations") Coroutine { installationId: String, conversationParams: String?, queryParamsJson: String? ->
            withContext(Dispatchers.IO) {
                logV("listConversations")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val params =
                    ConversationParamsWrapper.conversationParamsFromJson(conversationParams ?: "")
                val queryParams = ConversationListParamsWrapper.conversationListParamsFromJson(queryParamsJson ?: "")
                val conversations =
                    client.conversations.list(
                        createdAfterNs = queryParams.createdAfterNs,
                        createdBeforeNs = queryParams.createdBeforeNs,
                        lastActivityAfterNs = queryParams.lastActivityAfterNs,
                        lastActivityBeforeNs = queryParams.lastActivityBeforeNs,
                        limit = queryParams.limit,
                        consentStates = queryParams.consentStates,
                        orderBy = queryParams.orderBy ?: Conversations.ListConversationsOrderBy.LAST_ACTIVITY
                    )
                conversations.map { conversation ->
                    ConversationWrapper.encode(client, conversation, params)
                }
            }
        }

        AsyncFunction("getHmacKeys") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                logV("getHmacKeys")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val hmacKeys = client.conversations.getHmacKeys()
                logV("$hmacKeys")
                hmacKeys.toByteArray().map { it.toInt() and 0xFF }
            }
        }

        AsyncFunction("getAllPushTopics") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                logV("getAllPushTopics")
                val client = clients[installationId] ?: throw XMTPException("No client")
                client.conversations.allPushTopics()
            }
        }

        AsyncFunction("conversationMessages") Coroutine { installationId: String, conversationId: String, queryParamsJson: String? ->
            withContext(Dispatchers.IO) {
                logV("conversationMessages")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                val queryParams = MessageQueryParamsWrapper.messageQueryParamsFromJson(queryParamsJson ?: "")
                conversation?.messages(
                    limit = queryParams.limit,
                    beforeNs = queryParams.beforeNs,
                    afterNs = queryParams.afterNs,
                    direction = DecodedMessage.SortDirection.valueOf(
                        queryParams.direction ?: "DESCENDING"
                    )
                )?.map { MessageWrapper.encode(it) }
            }
        }

        AsyncFunction("conversationMessagesWithReactions") Coroutine { installationId: String, conversationId: String, queryParamsJson: String? ->
            withContext(Dispatchers.IO) {
                logV("conversationMessagesWithReactions")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                val queryParams = MessageQueryParamsWrapper.messageQueryParamsFromJson(queryParamsJson ?: "")
                conversation?.messagesWithReactions(
                    limit = queryParams.limit,
                    beforeNs = queryParams.beforeNs,
                    afterNs = queryParams.afterNs,
                    direction = DecodedMessage.SortDirection.valueOf(
                        queryParams.direction ?: "DESCENDING"
                    )
                )?.map { MessageWrapper.encode(it) }
            }
        }

        AsyncFunction("findMessage") Coroutine { installationId: String, messageId: String ->
            withContext(Dispatchers.IO) {
                logV("findMessage")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val message = client.conversations.findMessage(messageId)
                message?.let {
                    MessageWrapper.encode(it)
                }
            }
        }

        AsyncFunction("findGroup") Coroutine { installationId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("findGroup")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                group?.let {
                    GroupWrapper.encode(client, it)
                }
            }
        }

        AsyncFunction("findConversation") Coroutine { installationId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                logV("findConversation")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                conversation?.let {
                    ConversationWrapper.encode(client, conversation)
                }
            }
        }

        AsyncFunction("findConversationByTopic") Coroutine { installationId: String, topic: String ->
            withContext(Dispatchers.IO) {
                logV("findConversationByTopic")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversationByTopic(topic)
                conversation?.let {
                    ConversationWrapper.encode(client, conversation)
                }
            }
        }

        AsyncFunction("findDmByInboxId") Coroutine { installationId: String, peerInboxId: String ->
            withContext(Dispatchers.IO) {
                logV("findDmByInboxId")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val dm = client.conversations.findDmByInboxId(peerInboxId)
                dm?.let {
                    DmWrapper.encode(client, dm)
                }
            }
        }

        AsyncFunction("findDmByIdentity") Coroutine { installationId: String, peerIdentity: String ->
            withContext(Dispatchers.IO) {
                logV("findDmByIdentity")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val identity = PublicIdentityWrapper.publicIdentityFromJson(peerIdentity)
                val dm = client.conversations.findDmByIdentity(identity)
                dm?.let {
                    DmWrapper.encode(client, dm)
                }
            }
        }

        AsyncFunction("sendEncodedContent") Coroutine { installationId: String, conversationId: String, encodedContentData: List<Int>, shouldPush: Boolean ->
            withContext(Dispatchers.IO) {
                logV("sendEncodedContent")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no conversation found for $conversationId")
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
                conversation.send(encodedContent, opts = MessageVisibilityOptions(shouldPush))
            }
        }

        AsyncFunction("sendMessage") Coroutine { installationId: String, id: String, contentJson: String ->
            withContext(Dispatchers.IO) {
                logV("sendMessage")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(id)
                    ?: throw XMTPException("no conversation found for $id")
                val sending = ContentJson.fromJson(contentJson)
                conversation.send(
                    content = sending.content,
                    options = SendOptions(contentType = sending.type)
                )
            }
        }

        AsyncFunction("publishPreparedMessages") Coroutine { installationId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("publishPreparedMessages")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(id)
                    ?: throw XMTPException("no conversation found for $id")
                conversation.publishMessages()
            }
        }

        AsyncFunction("prepareMessage") Coroutine { installationId: String, id: String, contentJson: String ->
            withContext(Dispatchers.IO) {
                logV("prepareMessage")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(id)
                    ?: throw XMTPException("no conversation found for $id")
                val sending = ContentJson.fromJson(contentJson)
                conversation.prepareMessage(
                    content = sending.content,
                    options = SendOptions(contentType = sending.type)
                )
            }
        }

        AsyncFunction("prepareEncodedMessage") Coroutine { installationId: String, conversationId: String, encodedContentData: List<Int>, shouldPush: Boolean ->
            withContext(Dispatchers.IO) {
                logV("prepareEncodedMessage")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no conversation found for $conversationId")
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
                conversation.prepareMessage(encodedContent = encodedContent, opts = MessageVisibilityOptions(shouldPush))
            }
        }

        AsyncFunction("findOrCreateDm") Coroutine { installationId: String, peerInboxId: String, disappearStartingAtNs: Long?, retentionDurationInNs: Long? ->
            withContext(Dispatchers.IO) {
                logV("findOrCreateDm")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val settings = if (disappearStartingAtNs != null && retentionDurationInNs != null) {
                    DisappearingMessageSettings(disappearStartingAtNs, retentionDurationInNs)
                } else {
                    null
                }
                val dm = client.conversations.findOrCreateDm(peerInboxId, settings)
                DmWrapper.encode(client, dm)
            }
        }

        AsyncFunction("findOrCreateDmWithIdentity") Coroutine { installationId: String, peerIdentity: String, disappearStartingAtNs: Long?, retentionDurationInNs: Long? ->
            withContext(Dispatchers.IO) {
                logV("findOrCreateDmWithIdentity")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val settings = if (disappearStartingAtNs != null && retentionDurationInNs != null) {
                    DisappearingMessageSettings(disappearStartingAtNs, retentionDurationInNs)
                } else {
                    null
                }
                val identity = PublicIdentityWrapper.publicIdentityFromJson(peerIdentity)
                val dm = client.conversations.findOrCreateDmWithIdentity(identity, settings)
                DmWrapper.encode(client, dm)
            }
        }

        AsyncFunction("createGroup") Coroutine { installationId: String, peerInboxIds: List<String>, permission: String, groupOptionsJson: String ->
            withContext(Dispatchers.IO) {
                logV("createGroup")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val permissionLevel = when (permission) {
                    "admin_only" -> GroupPermissionPreconfiguration.ADMIN_ONLY
                    else -> GroupPermissionPreconfiguration.ALL_MEMBERS
                }
                val createGroupParams =
                    CreateGroupParamsWrapper.createGroupParamsFromJson(groupOptionsJson)
                val group = client.conversations.newGroup(
                    peerInboxIds,
                    permissionLevel,
                    createGroupParams.groupName,
                    createGroupParams.groupImageUrl,
                    createGroupParams.groupDescription,
                    createGroupParams.disappearingMessageSettings
                )
                GroupWrapper.encode(client, group)
            }
        }

        AsyncFunction("createGroupCustomPermissions") Coroutine { installationId: String, peerInboxIds: List<String>, permissionPolicySetJson: String, groupOptionsJson: String ->
            withContext(Dispatchers.IO) {
                logV("createGroup")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val createGroupParams =
                    CreateGroupParamsWrapper.createGroupParamsFromJson(groupOptionsJson)
                val permissionPolicySet =
                    PermissionPolicySetWrapper.createPermissionPolicySetFromJson(
                        permissionPolicySetJson
                    )
                val group = client.conversations.newGroupCustomPermissions(
                    peerInboxIds,
                    permissionPolicySet,
                    createGroupParams.groupName,
                    createGroupParams.groupImageUrl,
                    createGroupParams.groupDescription,
                    createGroupParams.disappearingMessageSettings
                )
                GroupWrapper.encode(client, group)
            }
        }

        AsyncFunction("createGroupWithIdentities") Coroutine { installationId: String, peerIdentities: List<String>, permission: String, groupOptionsJson: String ->
            withContext(Dispatchers.IO) {
                logV("createGroupWithIdentities")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val permissionLevel = when (permission) {
                    "admin_only" -> GroupPermissionPreconfiguration.ADMIN_ONLY
                    else -> GroupPermissionPreconfiguration.ALL_MEMBERS
                }
                val createGroupParams =
                    CreateGroupParamsWrapper.createGroupParamsFromJson(groupOptionsJson)
                val identities =
                    peerIdentities.map { PublicIdentityWrapper.publicIdentityFromJson(it) }
                val group = client.conversations.newGroupWithIdentities(
                    identities,
                    permissionLevel,
                    createGroupParams.groupName,
                    createGroupParams.groupImageUrl,
                    createGroupParams.groupDescription,
                    createGroupParams.disappearingMessageSettings
                )
                GroupWrapper.encode(client, group)
            }
        }

        AsyncFunction("createGroupCustomPermissionsWithIdentities") Coroutine { installationId: String, peerIdentities: List<String>, permissionPolicySetJson: String, groupOptionsJson: String ->
            withContext(Dispatchers.IO) {
                logV("createGroupCustomPermissionsWithIdentities")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val createGroupParams =
                    CreateGroupParamsWrapper.createGroupParamsFromJson(groupOptionsJson)
                val permissionPolicySet =
                    PermissionPolicySetWrapper.createPermissionPolicySetFromJson(
                        permissionPolicySetJson
                    )
                val identities =
                    peerIdentities.map { PublicIdentityWrapper.publicIdentityFromJson(it) }
                val group = client.conversations.newGroupCustomPermissionsWithIdentities(
                    identities,
                    permissionPolicySet,
                    createGroupParams.groupName,
                    createGroupParams.groupImageUrl,
                    createGroupParams.groupDescription,
                    createGroupParams.disappearingMessageSettings
                )
                GroupWrapper.encode(client, group)
            }
        }

        AsyncFunction("createGroupOptimistic") Coroutine { installationId: String, permission: String, groupOptionsJson: String ->
            withContext(Dispatchers.IO) {
                logV("createGroupOptimistic")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val permissionLevel = when (permission) {
                    "admin_only" -> GroupPermissionPreconfiguration.ADMIN_ONLY
                    else -> GroupPermissionPreconfiguration.ALL_MEMBERS
                }
                val createGroupParams =
                    CreateGroupParamsWrapper.createGroupParamsFromJson(groupOptionsJson)
                val group = client.conversations.newGroupOptimistic(
                    permissionLevel,
                    createGroupParams.groupName,
                    createGroupParams.groupImageUrl,
                    createGroupParams.groupDescription,
                    createGroupParams.disappearingMessageSettings
                )
                GroupWrapper.encode(client, group)
            }
        }

        AsyncFunction("listMemberInboxIds") Coroutine { installationId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("listMembers")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(id)
                    ?: throw XMTPException("no conversation found for $id")
                conversation.members().map { it.inboxId }
            }
        }

        AsyncFunction("dmPeerInboxId") Coroutine { installationId: String, dmId: String ->
            withContext(Dispatchers.IO) {
                logV("dmPeerInboxId")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(dmId)
                    ?: throw XMTPException("no conversation found for $dmId")
                val dm = (conversation as Conversation.Dm).dm
                dm.peerInboxId
            }
        }

        AsyncFunction("listConversationMembers") Coroutine { installationId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                logV("listConversationMembers")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no conversation found for $conversationId")
                conversation.members().map { MemberWrapper.encode(it) }
            }
        }

        AsyncFunction("syncConversations") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                logV("syncConversations")
                val client = clients[installationId] ?: throw XMTPException("No client")
                client.conversations.sync()
            }
        }

        AsyncFunction("syncAllConversations") Coroutine { installationId: String, consentStringStates: List<String>? ->
            withContext(Dispatchers.IO) {
                logV("syncAllConversations")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val consentStates = consentStringStates?.let { ConsentWrapper.getConsentStates(it) }
                val numGroupsSyncedInt: Int =
                    client.conversations.syncAllConversations(consentStates).numSynced.toInt()
                numGroupsSyncedInt
            }
        }

        AsyncFunction("syncConversation") Coroutine { installationId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("syncConversation")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(id)
                    ?: throw XMTPException("no conversation found for $id")
                conversation.sync()
            }
        }

        AsyncFunction("addGroupMembers") Coroutine { installationId: String, groupId: String, peerInboxIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("addGroupMembers")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                MembershipResultWrapper.encode(group.addMembers(peerInboxIds))
            }
        }

        AsyncFunction("removeGroupMembers") Coroutine { installationId: String, groupId: String, peerInboxIds: List<String> ->
            withContext(Dispatchers.IO) {
                logV("removeGroupMembers")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.removeMembers(peerInboxIds)
            }
        }

        AsyncFunction("addGroupMembersByIdentity") Coroutine { installationId: String, groupId: String, peerIdentities: List<String> ->
            withContext(Dispatchers.IO) {
                logV("addGroupMembersByIdentity")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                val identities =
                    peerIdentities.map { PublicIdentityWrapper.publicIdentityFromJson(it) }
                MembershipResultWrapper.encode(group.addMembersByIdentity(identities))
            }
        }

        AsyncFunction("removeGroupMembersByIdentity") Coroutine { installationId: String, groupId: String, peerIdentities: List<String> ->
            withContext(Dispatchers.IO) {
                logV("removeGroupMembersByIdentity")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                val identities =
                    peerIdentities.map { PublicIdentityWrapper.publicIdentityFromJson(it) }
                group.removeMembersByIdentity(identities)
            }
        }

        AsyncFunction("groupName") Coroutine { installationId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("groupName")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.name
            }
        }

        AsyncFunction("updateGroupName") Coroutine { installationId: String, groupId: String, groupName: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupName")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateName(groupName)
            }
        }

        AsyncFunction("groupImageUrl") Coroutine { installationId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("groupImageUrl")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.imageUrl
            }
        }

        AsyncFunction("updateGroupImageUrl") Coroutine { installationId: String, groupId: String, groupImageUrl: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupImageUrl")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateImageUrl(groupImageUrl)
            }
        }

        AsyncFunction("groupDescription") Coroutine { installationId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("groupDescription")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.description
            }
        }

        AsyncFunction("updateGroupDescription") Coroutine { installationId: String, groupId: String, groupDescription: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupDescription")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateDescription(groupDescription)
            }
        }

        AsyncFunction("disappearingMessageSettings") Coroutine { installationId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                logV("disappearingMessageSettings")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no conversation found for $conversationId")
                val settings = conversation.disappearingMessageSettings
                settings?.let { DisappearingMessageSettingsWrapper.encode(it) }
            }
        }

        AsyncFunction("isDisappearingMessagesEnabled") Coroutine { installationId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                logV("isDisappearingMessagesEnabled")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no conversation found for $conversationId")
                conversation.isDisappearingMessagesEnabled
            }
        }

        AsyncFunction("clearDisappearingMessageSettings") Coroutine { installationId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                logV("clearDisappearingMessageSettings")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no conversation found for $conversationId")
                conversation.clearDisappearingMessageSettings()
            }
        }

        AsyncFunction("updateDisappearingMessageSettings") Coroutine { installationId: String, conversationId: String, startAtNs: Long, durationInNs: Long ->
            withContext(Dispatchers.IO) {
                logV("updateDisappearingMessageSettings")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no conversation found for $conversationId")
                conversation.updateDisappearingMessageSettings(
                    DisappearingMessageSettings(
                        startAtNs,
                        durationInNs
                    )
                )
            }
        }

        AsyncFunction("isActive") Coroutine { installationId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                logV("isActive")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no conversation found for $conversationId")
                conversation.isActive()
            }
        }

        AsyncFunction("addedByInboxId") Coroutine { installationId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("addedByInboxId")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.addedByInboxId()
            }
        }

        AsyncFunction("creatorInboxId") Coroutine { installationId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("creatorInboxId")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.creatorInboxId()
            }
        }

        AsyncFunction("isAdmin") Coroutine { clientInstallationId: String, groupId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("isGroupAdmin")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.isAdmin(inboxId)
            }
        }

        AsyncFunction("isSuperAdmin") Coroutine { clientInstallationId: String, groupId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("isSuperAdmin")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.isSuperAdmin(inboxId)
            }
        }

        AsyncFunction("listAdmins") Coroutine { installationId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("listAdmins")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.listAdmins()
            }
        }

        AsyncFunction("listSuperAdmins") Coroutine { installationId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("listSuperAdmins")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.listSuperAdmins()
            }
        }

        AsyncFunction("addAdmin") Coroutine { clientInstallationId: String, groupId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("addAdmin")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.addAdmin(inboxId)
            }
        }

        AsyncFunction("addSuperAdmin") Coroutine { clientInstallationId: String, groupId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("addSuperAdmin")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.addSuperAdmin(inboxId)
            }
        }

        AsyncFunction("removeAdmin") Coroutine { clientInstallationId: String, groupId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("removeAdmin")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.removeAdmin(inboxId)
            }
        }

        AsyncFunction("removeSuperAdmin") Coroutine { clientInstallationId: String, groupId: String, inboxId: String ->
            withContext(Dispatchers.IO) {
                logV("removeSuperAdmin")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.removeSuperAdmin(inboxId)
            }
        }

        AsyncFunction("updateAddMemberPermission") Coroutine { clientInstallationId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateAddMemberPermission")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateAddMemberPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateRemoveMemberPermission") Coroutine { clientInstallationId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateRemoveMemberPermission")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateRemoveMemberPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateAddAdminPermission") Coroutine { clientInstallationId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateAddAdminPermission")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateAddAdminPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateRemoveAdminPermission") Coroutine { clientInstallationId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateRemoveAdminPermission")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateRemoveAdminPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateGroupNamePermission") Coroutine { clientInstallationId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupNamePermission")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateNamePermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateGroupImageUrlPermission") Coroutine { clientInstallationId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupImageUrlPermission")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateImageUrlPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("updateGroupDescriptionPermission") Coroutine { clientInstallationId: String, groupId: String, newPermission: String ->
            withContext(Dispatchers.IO) {
                logV("updateGroupDescriptionPermission")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.updateDescriptionPermission(getPermissionOption(newPermission))
            }
        }

        AsyncFunction("permissionPolicySet") Coroutine { installationId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("permissionPolicySet")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                val permissionPolicySet = group.permissionPolicySet()
                PermissionPolicySetWrapper.encodeToJsonString(permissionPolicySet)
            }
        }

        AsyncFunction("processMessage") Coroutine { installationId: String, id: String, encryptedMessage: String ->
            withContext(Dispatchers.IO) {
                logV("processMessage")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(id)
                    ?: throw XMTPException("no conversation found for $id")
                val message = conversation.processMessage(Base64.decode(encryptedMessage, NO_WRAP))
                message?.let {
                    MessageWrapper.encode(it)
                }
            }
        }

        AsyncFunction("processWelcomeMessage") Coroutine { installationId: String, encryptedMessage: String ->
            withContext(Dispatchers.IO) {
                logV("processWelcomeMessage")
                val client = clients[installationId] ?: throw XMTPException("No client")

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

        AsyncFunction("syncConsent") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                client.preferences.syncConsent()
            }
        }

        AsyncFunction("syncPreferences") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                client.preferences.sync()
            }
        }

        AsyncFunction("setConsentState") Coroutine { installationId: String, value: String, entryType: String, consentType: String ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                client.preferences.setConsentState(
                    listOf(
                        ConsentRecord(
                            value,
                            ConsentWrapper.getEntryType(entryType),
                            ConsentWrapper.getConsentState(consentType)
                        )
                    )
                )
            }
        }

        AsyncFunction("setConsentStates") Coroutine { installationId: String, consentRecords: List<String> ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                val states = consentRecords.map { ConsentWrapper.consentRecordFromJson(it) }
                client.preferences.setConsentState(states)
            }
        }

        AsyncFunction("consentInboxIdState") Coroutine { installationId: String, peerInboxId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                ConsentWrapper.consentStateToString(client.preferences.inboxIdState(peerInboxId))
            }
        }

        AsyncFunction("consentConversationIdState") Coroutine { installationId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                ConsentWrapper.consentStateToString(
                    client.preferences.conversationState(
                        conversationId
                    )
                )
            }
        }

        AsyncFunction("conversationConsentState") Coroutine { installationId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no group found for $conversationId")
                ConsentWrapper.consentStateToString(conversation.consentState())
            }
        }

        AsyncFunction("updateConversationConsent") Coroutine { installationId: String, conversationId: String, state: String ->
            withContext(Dispatchers.IO) {
                logV("updateConversationConsent")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no group found for $conversationId")

                conversation.updateConsentState(ConsentWrapper.getConsentState(state))
            }
        }

        AsyncFunction("pausedForVersion") Coroutine { installationId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                logV("pausedForVersion")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no group found for $conversationId")
                conversation.pausedForVersion()
            }
        }

        AsyncFunction("getConversationHmacKeys") Coroutine { installationId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                logV("getConversationHmacKeys")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no group found for $conversationId")
                conversation.getHmacKeys()
            }
        }

        AsyncFunction("getConversationPushTopics") Coroutine { installationId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                logV("getConversationPushTopics")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no group found for $conversationId")
                conversation.getPushTopics()
            }
        }

        AsyncFunction("getDebugInformation") Coroutine { installationId: String, conversationId: String ->
            withContext(Dispatchers.IO) {
                logV("getDebugInformation")
                val client = clients[installationId] ?: throw XMTPException("No client")
                val conversation = client.conversations.findConversation(conversationId)
                    ?: throw XMTPException("no group found for $conversationId")
                ConversationDebugInfoWrapper.encode(conversation.getDebugInformation())
            }
        }

        AsyncFunction("leaveGroup") Coroutine { clientInstallationId: String, groupId: String ->
            withContext(Dispatchers.IO) {
                logV("leaveGroup")
                val client = clients[clientInstallationId] ?: throw XMTPException("No client")
                val group = client.conversations.findGroup(groupId)
                    ?: throw XMTPException("no group found for $groupId")
                group.leaveGroup()
            }
        }

        Function("subscribeToPreferenceUpdates") { installationId: String ->
            logV("subscribeToPreferenceUpdates")

            subscribeToPreferenceUpdates(installationId = installationId)
        }

        Function("subscribeToConsent") { installationId: String ->
            logV("subscribeToConsent")

            subscribeToConsent(installationId = installationId)
        }

        Function("subscribeToConversations") { installationId: String, type: String ->
            logV("subscribeToConversations")

            subscribeToConversations(installationId = installationId, getStreamType(type))
        }

        Function("subscribeToAllMessages") { installationId: String, type: String, consentStates: List<String>? ->
            logV("subscribeToAllMessages")
            subscribeToAllMessages(
                installationId = installationId,
                getStreamType(type),
                if (consentStates.isNullOrEmpty()) null else ConsentWrapper.getConsentStates(
                    consentStates
                )
            )
        }

        AsyncFunction("subscribeToMessages") Coroutine { installationId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("subscribeToMessages")
                subscribeToMessages(
                    installationId = installationId,
                    id = id
                )
            }
        }

        AsyncFunction("subscribeToMessageDeletions") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                logV("subscribeToMessageDeletions")
                subscribeToMessageDeletions(
                    installationId = installationId,
                )
            }
        }

        Function("unsubscribeFromPreferenceUpdates") { installationId: String ->
            logV("unsubscribeFromPreferenceUpdates")
            subscriptions[getPreferenceUpdatesKey(installationId)]?.cancel()
        }

        Function("unsubscribeFromConsent") { installationId: String ->
            logV("unsubscribeFromConsent")
            subscriptions[getConsentKey(installationId)]?.cancel()
        }

        Function("unsubscribeFromConversations") { installationId: String ->
            logV("unsubscribeFromConversations")
            subscriptions[getConversationsKey(installationId)]?.cancel()
        }

        Function("unsubscribeFromAllMessages") { installationId: String ->
            logV("unsubscribeFromAllMessages")
            subscriptions[getMessagesKey(installationId)]?.cancel()
        }

        AsyncFunction("unsubscribeFromMessages") Coroutine { installationId: String, id: String ->
            withContext(Dispatchers.IO) {
                logV("unsubscribeFromMessages")
                unsubscribeFromMessages(
                    installationId = installationId,
                    id = id
                )
            }
        }

        Function("registerPushToken") { pushServer: String, token: String ->
            logV("registerPushToken")
            xmtpPush = XMTPPush(appContext.reactContext!!, pushServer)
            xmtpPush?.register(token)
        }

        AsyncFunction("subscribePushTopics") Coroutine { installationId: String, topics: List<String> ->
            withContext(Dispatchers.IO) {
                logV("subscribePushTopics")
                if (topics.isNotEmpty()) {
                    if (xmtpPush == null) {
                        throw XMTPException("Push server not registered")
                    }
                    val client = clients[installationId] ?: throw XMTPException("No client")

                    val hmacKeysResult = client.conversations.getHmacKeys()
                    val subscriptions = topics.map {
                        val hmacKeys = hmacKeysResult.hmacKeysMap
                        val result = hmacKeys[it]?.valuesList?.map { hmacKey ->
                            Service.Subscription.HmacKey.newBuilder().also { sub_key ->
                                sub_key.key = hmacKey.hmacKey
                                sub_key.thirtyDayPeriodsSinceEpoch =
                                    hmacKey.thirtyDayPeriodsSinceEpoch
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
        }

        AsyncFunction("exportNativeLogs") Coroutine { ->
            withContext(Dispatchers.IO) {
                try {
                    val maxLines = 10000 // Limit total lines to prevent memory issues
                    val command = "logcat -d -t $maxLines"

                    val process = Runtime.getRuntime().exec(command.toString())
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

        AsyncFunction("getNetworkDebugInformation") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                NetworkDebugInfoWrapper.encode(client.debugInformation)
            }
        }

        AsyncFunction("clearAllNetworkStatistics") Coroutine { installationId: String ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                client.debugInformation.clearAllStatistics()
            }
        }

        AsyncFunction("createArchive") Coroutine { installationId: String, path: String, encryptionKey: List<Int>, startNs: Int?, endNs: Int?, archiveElements: List<String>? ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                val encryptionKeyBytes =
                    encryptionKey.foldIndexed(ByteArray(encryptionKey.size)) { i, a, v ->
                        a.apply { set(i, v.toByte()) }
                    }
                val elements = archiveElements?.map { getArchiveElement(it) } ?: listOf(ArchiveElement.MESSAGES, ArchiveElement.CONSENT)
                val archiveOptions = ArchiveOptions(startNs?.toLong(), endNs?.toLong(), elements)
                client.createArchive(path, encryptionKeyBytes, archiveOptions)
            }
        }

        AsyncFunction("importArchive") Coroutine { installationId: String, path: String, encryptionKey: List<Int> ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                val encryptionKeyBytes =
                    encryptionKey.foldIndexed(ByteArray(encryptionKey.size)) { i, a, v ->
                        a.apply { set(i, v.toByte()) }
                    }
                client.importArchive(path, encryptionKeyBytes)
            }
        }

        AsyncFunction("archiveMetadata") Coroutine { installationId: String, path: String, encryptionKey: List<Int> ->
            withContext(Dispatchers.IO) {
                val client = clients[installationId] ?: throw XMTPException("No client")
                val encryptionKeyBytes =
                    encryptionKey.foldIndexed(ByteArray(encryptionKey.size)) { i, a, v ->
                        a.apply { set(i, v.toByte()) }
                    }
                val metadata = client.archiveMetadata(path, encryptionKeyBytes)
                ArchiveMetadataWrapper.encode(metadata)
            }
        }
    }


    //
    // Helpers
    //

    // Add this method to get SharedPreferences
    private fun getSharedPreferences(): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    // Add this to check if log writer was active
    private fun isLogWriterActive(): Boolean {
        return getSharedPreferences().getBoolean(LOG_WRITER_ACTIVE_KEY, false)
    }

    // Add this to save log writer state
    private fun setLogWriterActive(active: Boolean) {
        getSharedPreferences().edit().putBoolean(LOG_WRITER_ACTIVE_KEY, active).apply()
    }

    private fun saveLogSettings(logLevel: Int, logRotation: Int, maxFiles: Int) {
        getSharedPreferences().edit()
            .putInt(LOG_LEVEL_KEY, logLevel)
            .putInt(LOG_ROTATION_KEY, logRotation)
            .putInt(LOG_MAX_FILES_KEY, maxFiles)
            .apply()
    }

    private fun getLogLevel(): Int {
        return getSharedPreferences().getInt(LOG_LEVEL_KEY, 3) // Default to DEBUG (3)
    }

    private fun getLogRotation(): Int {
        return getSharedPreferences().getInt(LOG_ROTATION_KEY, 2) // Default to HOURLY (2)
    }

    private fun getLogMaxFiles(): Int {
        return getSharedPreferences().getInt(LOG_MAX_FILES_KEY, 5) // Default to 5 files
    }

    private fun getFfiLogLevel(logLevel: Int): FfiLogLevel {
        return when (logLevel) {
            0 -> FfiLogLevel.ERROR
            1 -> FfiLogLevel.WARN
            2 -> FfiLogLevel.INFO
            3 -> FfiLogLevel.DEBUG
            4 -> FfiLogLevel.TRACE
            else -> FfiLogLevel.DEBUG
        }
    }

    private fun getFfiLogRotation(logRotation: Int): FfiLogRotation {
        return when (logRotation) {
            0 -> FfiLogRotation.NEVER
            1 -> FfiLogRotation.DAILY
            2 -> FfiLogRotation.HOURLY
            3 -> FfiLogRotation.MINUTELY
            else -> FfiLogRotation.HOURLY
        }
    }

    private fun getPermissionOption(permissionString: String): PermissionOption {
        return when (permissionString) {
            "allow" -> PermissionOption.Allow
            "deny" -> PermissionOption.Deny
            "admin" -> PermissionOption.Admin
            "super_admin" -> PermissionOption.SuperAdmin
            else -> throw XMTPException("Invalid permission option: $permissionString")
        }
    }

    private fun getStreamType(typeString: String): ConversationFilterType {
        return when (typeString) {
            "groups" -> ConversationFilterType.GROUPS
            "dms" -> ConversationFilterType.DMS
            else -> ConversationFilterType.ALL
        }
    }

    private fun preferenceTypeToString(type: PreferenceType): String {
        return when (type) {
            PreferenceType.HMAC_KEYS -> "hmac_keys"
        }
    }

    private fun getArchiveElement(element: String): ArchiveElement {
        return when (element) {
            "consent" -> ArchiveElement.CONSENT
            "message","messages" -> ArchiveElement.MESSAGES
            else -> throw XMTPException("Invalid archive element: $element")
        }
    }

    enum class SignatureType(val typeName: String) {
        REVOKE_INSTALLATIONS("revokeInstallations");
    }

    private fun subscribeToPreferenceUpdates(installationId: String) {
        val client = clients[installationId] ?: throw XMTPException("No client")

        subscriptions[getPreferenceUpdatesKey(installationId)]?.cancel()
        subscriptions[getPreferenceUpdatesKey(installationId)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    client.preferences.streamPreferenceUpdates(onClose = {
                        sendEvent(
                            "preferencesClosed", mapOf(
                                "installationId" to installationId,
                            )
                        )
                    }).collect { type ->
                        sendEvent(
                            "preferences",
                            mapOf(
                                "installationId" to installationId,
                                "preferenceType" to preferenceTypeToString(type)
                            )
                        )
                    }
                } catch (e: Exception) {
                    Log.e("XMTPModule", "Error in preference subscription: $e")
                    subscriptions[getPreferenceUpdatesKey(installationId)]?.cancel()
                }
            }
    }

    private fun subscribeToConsent(installationId: String) {
        val client = clients[installationId] ?: throw XMTPException("No client")

        subscriptions[getConsentKey(installationId)]?.cancel()
        subscriptions[getConsentKey(installationId)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    client.preferences.streamConsent(onClose = {
                        sendEvent(
                            "consentClosed", mapOf(
                                "installationId" to installationId,
                            )
                        )
                    }).collect { consent ->
                        sendEvent(
                            "consent",
                            mapOf(
                                "installationId" to installationId,
                                "consent" to ConsentWrapper.encodeMap(consent)
                            )
                        )
                    }
                } catch (e: Exception) {
                    Log.e("XMTPModule", "Error in consent subscription: $e")
                    subscriptions[getConsentKey(installationId)]?.cancel()
                }
            }
    }

    private fun subscribeToConversations(installationId: String, type: ConversationFilterType) {
        val client = clients[installationId] ?: throw XMTPException("No client")

        subscriptions[getConversationsKey(installationId)]?.cancel()
        subscriptions[getConversationsKey(installationId)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    client.conversations.stream(type, onClose = {
                        sendEvent(
                            "conversationClosed", mapOf(
                                "installationId" to installationId,
                            )
                        )
                    }).collect { conversation ->
                        sendEvent(
                            "conversation",
                            mapOf(
                                "installationId" to installationId,
                                "conversation" to ConversationWrapper.encodeToObj(
                                    client,
                                    conversation
                                )
                            )
                        )
                    }
                } catch (e: Exception) {
                    Log.e("XMTPModule", "Error in group subscription: $e")
                    subscriptions[getConversationsKey(installationId)]?.cancel()
                }
            }
    }

    private fun subscribeToAllMessages(
        installationId: String,
        type: ConversationFilterType,
        consentState: List<ConsentState>?,
    ) {
        val client = clients[installationId] ?: throw XMTPException("No client")

        subscriptions[getMessagesKey(installationId)]?.cancel()
        subscriptions[getMessagesKey(installationId)] = CoroutineScope(Dispatchers.IO).launch {
            try {
                client.conversations.streamAllMessages(type, consentState, onClose = {
                    sendEvent(
                        "messageClosed", mapOf(
                            "installationId" to installationId,
                        )
                    )
                }).collect { message ->
                    sendEvent(
                        "message",
                        mapOf(
                            "installationId" to installationId,
                            "message" to MessageWrapper.encodeMap(message),
                        )
                    )
                }
            } catch (e: Exception) {
                Log.e("XMTPModule", "Error in all group messages subscription: $e")
                subscriptions[getMessagesKey(installationId)]?.cancel()
            }
        }
    }

    private suspend fun subscribeToMessages(installationId: String, id: String) {
        val client = clients[installationId] ?: throw XMTPException("No client")
        val conversation = client.conversations.findConversation(id)
            ?: throw XMTPException("no conversation found for $id")
        subscriptions[conversation.cacheKey(installationId)]?.cancel()
        subscriptions[conversation.cacheKey(installationId)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    conversation.streamMessages(onClose = {
                        sendEvent(
                            "conversationMessageClosed", mapOf(
                                "installationId" to installationId,
                                "conversationId" to id
                            )
                        )
                    }).collect { message ->
                        sendEvent(
                            "conversationMessage",
                            mapOf(
                                "installationId" to installationId,
                                "message" to MessageWrapper.encodeMap(message),
                                "conversationId" to id,
                            )
                        )
                    }
                } catch (e: Exception) {
                    Log.e("XMTPModule", "Error in messages subscription: $e")
                    subscriptions[conversation.cacheKey(installationId)]?.cancel()
                }
            }
    }

    private fun subscribeToMessageDeletions(installationId: String) {
        val client = clients[installationId] ?: throw XMTPException("No client")

        subscriptions[getMessageDeletionsCacheKey(installationId)]?.cancel()
        subscriptions[getMessageDeletionsCacheKey(installationId)] =
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    client.conversations.streamMessageDeletions(onClose = {
                        sendEvent(
                            "messageDeletionClosed", mapOf(
                                "installationId" to installationId,
                            )
                        )
                    }).collect { message ->
                        sendEvent(
                            "messageDeletion",
                            mapOf(
                                "installationId" to installationId,
                                "messageId" to message.id,
                                "conversationId" to message.conversationId,
                                )
                            )
                    }
                } catch (e: Exception) {
                    Log.e("XMTPModule", "Error in message deletions subscription: $e")
                    subscriptions[getMessageDeletionsCacheKey(installationId)]?.cancel()
                }
            }
    }

    private fun getPreferenceUpdatesKey(installationId: String): String {
        return "preferences:$installationId"
    }

    private fun getConsentKey(installationId: String): String {
        return "consent:$installationId"
    }

    private fun getMessagesKey(installationId: String): String {
        return "messages:$installationId"
    }

    private fun getConversationsKey(installationId: String): String {
        return "conversations:$installationId"
    }

    private suspend fun unsubscribeFromMessages(
        installationId: String,
        id: String,
    ) {
        val client = clients[installationId] ?: throw XMTPException("No client")
        val convo = client.conversations.findConversation(id) ?: return
        subscriptions[convo.cacheKey(installationId)]?.cancel()
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

    private fun activateLogWriterIfEnabled() {
        if (isLogWriterActive()) {
            val logLevel = getFfiLogLevel(getLogLevel())
            val logRotation = getFfiLogRotation(getLogRotation())
            val maxFiles = getLogMaxFiles()

            Client.activatePersistentLibXMTPLogWriter(context, logLevel, logRotation, maxFiles)
        }
    }
}
