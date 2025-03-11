package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonParser
import org.xmtp.android.library.libxmtp.IdentityKind
import org.xmtp.android.library.libxmtp.InboxState
import org.xmtp.android.library.libxmtp.PublicIdentity

class PublicIdentityWrapper(
    val identifier: String,
    val kind: IdentityKind,
) {
    companion object {
        fun publicIdentityFromJson(pubIdParams: String): PublicIdentity {
            val jsonOptions = JsonParser.parseString(pubIdParams).asJsonObject
            return PublicIdentity(
                when (jsonOptions.get("kind").asString) {
                    "PASSKEY" -> IdentityKind.PASSKEY
                    else -> IdentityKind.ETHEREUM
                },
                jsonOptions.get("identifier").asString,
            )
        }

        val gson: Gson = GsonBuilder().create()
        private fun encodeToObj(publicIdentity: PublicIdentity): Map<String, Any> {
            return mapOf(
                "identifier" to publicIdentity.identifier,
                "kind" to when (publicIdentity.kind) {
                    IdentityKind.PASSKEY -> "PASSKEY"
                    else -> "ETHEREUM"
                },
            )
        }

        fun encode(publicIdentity: PublicIdentity): String {
            val obj = encodeToObj(publicIdentity)
            return gson.toJson(obj)
        }
    }
}
