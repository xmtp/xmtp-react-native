package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import org.xmtp.android.library.libxmtp.InboxState

class InboxStateWrapper {
    companion object {
        val gson: Gson = GsonBuilder().create()
        private fun encodeToObj(inboxState: InboxState): Map<String, Any> {
            return mapOf(
                "inboxId" to inboxState.inboxId,
                "identities" to inboxState.identities.map { PublicIdentityWrapper.encode(it) },
                "installations" to inboxState.installations.map {
                    gson.toJson(
                        mapOf(
                            "id" to it.installationId,
                            "createdAt" to it.createdAt?.time
                        )
                    )
                },
                "recoveryIdentity" to PublicIdentityWrapper.encode(inboxState.recoveryPublicIdentity)
            )
        }

        fun encode(inboxState: InboxState): String {
            val obj = encodeToObj(inboxState)
            return gson.toJson(obj)
        }
    }
}