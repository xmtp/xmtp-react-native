package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.JsonParser
import org.xmtp.android.library.libxmtp.DisappearingMessageSettings

class CreateGroupParamsWrapper(
    val groupName: String,
    val groupImageUrl: String,
    val groupDescription: String,
    val disappearingMessageSettings: DisappearingMessageSettings?,
    val appData: String,
) {
    companion object {
        fun createGroupParamsFromJson(authParams: String): CreateGroupParamsWrapper {
            val jsonOptions = JsonParser.parseString(authParams).asJsonObject

            // Only create DisappearingMessageSettings if both values are provided
            val settings = if (jsonOptions.has("disappearStartingAtNs") && jsonOptions.has("retentionDurationInNs")) {
                DisappearingMessageSettings(
                    jsonOptions.get("disappearStartingAtNs").asLong,
                    jsonOptions.get("retentionDurationInNs").asLong
                )
            } else {
                null
            }

            return CreateGroupParamsWrapper(
                if (jsonOptions.has("name")) jsonOptions.get("name").asString else "",
                if (jsonOptions.has("imageUrl")) jsonOptions.get("imageUrl").asString else "",
                if (jsonOptions.has("description")) jsonOptions.get("description").asString else "",
                settings,
                if (jsonOptions.has("appData")) jsonOptions.get("appData").asString else "",
            )
        }
    }
}
