package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import uniffi.xmtpv3.org.xmtp.android.library.libxmtp.InboxState

class InboxStateWrapper {
    companion object {
        fun encodeToObj(inboxState: InboxState): Map<String, Any> {
            return mapOf(
                "inboxId" to inboxState.inboxId,
                "addresses" to inboxState.addresses,
                "installationIds" to inboxState.installationIds,
                "recoveryAddress" to inboxState.recoveryAddress
            )
        }

        fun encode(inboxState: InboxState): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(inboxState)
            return gson.toJson(obj)
        }
    }
}