package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.JsonParser
import org.xmtp.android.library.libxmtp.IdentityKind
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
    }
}
