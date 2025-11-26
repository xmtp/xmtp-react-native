package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.GroupSyncSummary

class GroupSyncSummaryWrapper {
    companion object {
        fun encode(model: GroupSyncSummary): String {
            val gson = GsonBuilder().create()
            val message = encodeMap(model)
            return gson.toJson(message)
        }

        fun encodeMap(model: GroupSyncSummary): Map<String, Any> =
            mapOf(
                "numEligible" to model.numEligible,
                "numSynced" to model.numSynced,
            )
    }
}
