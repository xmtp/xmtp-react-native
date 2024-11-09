package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import uniffi.xmtpv3.org.xmtp.android.library.libxmtp.InboxState

class InboxStateWrapper {
    companion object {
        val gson: Gson = GsonBuilder().create()
        private fun encodeToObj(inboxState: InboxState): Map<String, Any> {
            return mapOf(
                "inboxId" to inboxState.inboxId,
                "addresses" to inboxState.addresses,
                "installations" to inboxState.installations.map {
                    gson.toJson(
                        mapOf(
                            "id" to it.installationId,
                            "createdAt" to it.createdAt?.time
                        )
                    )
                },
                "recoveryAddress" to inboxState.recoveryAddress
            )
        }

        fun encode(inboxState: InboxState): String {
            val obj = encodeToObj(inboxState)
            return gson.toJson(obj)
        }
    }
}