package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import org.xmtp.android.library.libxmtp.InboxState
import org.xmtp.android.library.libxmtp.SignatureKind

class InboxStateWrapper {
    companion object {
        val gson: Gson = GsonBuilder().create()

        private fun signatureKindToString(kind: SignatureKind?): String {
            return when (kind) {
                SignatureKind.ERC191 -> "ERC191"
                SignatureKind.ERC1271 -> "ERC1271"
                SignatureKind.INSTALLATION_KEY -> "INSTALLATION_KEY"
                SignatureKind.LEGACY_DELEGATED -> "LEGACY_DELEGATED"
                SignatureKind.P256 -> "P256"
                null -> ""
            }
        }
        private fun encodeToObj(inboxState: InboxState): Map<String, Any> {
            return mapOf(
                    "inboxId" to inboxState.inboxId,
                    "identities" to inboxState.identities.map { PublicIdentityWrapper.encode(it) },
                    "installations" to
                            inboxState.installations.map {
                                gson.toJson(
                                        mapOf(
                                                "id" to it.installationId,
                                                "createdAt" to it.createdAt?.time
                                        )
                                )
                            },
                    "recoveryIdentity" to
                            PublicIdentityWrapper.encode(inboxState.recoveryPublicIdentity),
                    "creationSignatureKind" to
                            signatureKindToString(inboxState.creationSignatureKind)
            )
        }

        fun encode(inboxState: InboxState): String {
            val obj = encodeToObj(inboxState)
            return gson.toJson(obj)
        }
    }
}
