package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.libxmtp.DisappearingMessageSettings

class DisappearingMessageSettingsWrapper {

    companion object {
        fun encode(model: DisappearingMessageSettings): String {
            val gson = GsonBuilder().create()
            val message = encodeMap(model)
            return gson.toJson(message)
        }

        fun encodeMap(model: DisappearingMessageSettings): Map<String, Any> = mapOf(
            "disappearStartingAtNs" to model.disappearStartingAtNs,
            "retentionDurationInNs" to model.retentionDurationInNs,
        )
    }
}