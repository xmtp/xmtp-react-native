package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import uniffi.xmtpv3.org.xmtp.android.library.libxmtp.ConversationDebugInfo

class ConversationDebugInfoWrapper {
    companion object {
        val gson: Gson = GsonBuilder().create()
        private fun encodeToObj(info: ConversationDebugInfo): Map<String, Any> {
            return mapOf(
                "epoch" to info.epoch,
                "maybeForked" to info.maybeForked,
                "forkDetails" to info.forkDetails,
            )
        }

        fun encode(info: ConversationDebugInfo): String {
            val obj = encodeToObj(info)
            return gson.toJson(obj)
        }
    }
}