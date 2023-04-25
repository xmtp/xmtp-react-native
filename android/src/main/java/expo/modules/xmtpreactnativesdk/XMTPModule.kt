package expo.modules.xmtpreactnativesdk

import android.util.Base64
import android.util.Base64.NO_WRAP
import com.google.protobuf.kotlin.toByteString
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.suspendCancellableCoroutine
import org.xmtp.android.library.Client
import org.xmtp.android.library.Conversation
import org.xmtp.android.library.SigningKey
import org.xmtp.android.library.XMTPException
import org.xmtp.android.library.messages.PrivateKeyBuilder
import org.xmtp.android.library.messages.Signature
import org.xmtp.proto.message.contents.SignatureOuterClass
import java.util.UUID
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ReactNativeSigner(var module: XMTPModule, override var address: String) : SigningKey {
    private var continuations: MutableMap<String, Continuation<Signature>> = mutableMapOf()

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
        // Generate a random wallet and set the client to that
        Function("createRandom") { ->
            val privateKey = PrivateKeyBuilder()
            val client2 = Client().create(account = privateKey)
            client = client2
            client!!.address
        }
    }
}

