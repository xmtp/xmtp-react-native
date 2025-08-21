package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import org.xmtp.android.library.libxmtp.ConversationDebugInfo

class ConversationDebugInfoWrapper {
    companion object {
        val gson: Gson = GsonBuilder().create()
        private fun encodeToObj(info: ConversationDebugInfo): Map<String, Any> {
            return mapOf(
                "epoch" to info.epoch,
                "maybeForked" to info.maybeForked,
                "forkDetails" to info.forkDetails,
                "localCommitLog" to info.localCommitLog,
               "remoteCommitLog" to info.remoteCommitLog,
                "commitLogForkStatus" to commitLogForkStatusToString(info.commitLogForkStatus)
            )
        }
        
        fun commitLogForkStatusToString(status: ConversationDebugInfo.CommitLogForkStatus): String {
            return when (status) {
                ConversationDebugInfo.CommitLogForkStatus.FORKED -> "forked"
                ConversationDebugInfo.CommitLogForkStatus.NOT_FORKED -> "notForked"
                else -> "unknown"
            }
        }

        fun encode(info: ConversationDebugInfo): String {
            val obj = encodeToObj(info)
            return gson.toJson(obj)
        }
    }
}