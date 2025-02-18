package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.JsonParser
import org.xmtp.android.library.libxmtp.DisappearingMessageSettings

class CreateGroupParamsWrapper(
    val groupName: String,
    val groupImageUrlSquare: String,
    val groupDescription: String,
    val disappearingMessageSettings: DisappearingMessageSettings,
) {
    companion object {
        fun createGroupParamsFromJson(authParams: String): CreateGroupParamsWrapper {
            val jsonOptions = JsonParser.parseString(authParams).asJsonObject
            val settings = DisappearingMessageSettings(
                if (jsonOptions.has("disappearStartingAtNs")) jsonOptions.get("disappearStartingAtNs").asLong else 0,
                if (jsonOptions.has("retentionDurationInNs")) jsonOptions.get("retentionDurationInNs").asLong else 0
            )

            return CreateGroupParamsWrapper(
                if (jsonOptions.has("name")) jsonOptions.get("name").asString else "",
                if (jsonOptions.has("imageUrlSquare")) jsonOptions.get("imageUrlSquare").asString else "",
                if (jsonOptions.has("description")) jsonOptions.get("description").asString else "",
                settings
            )
        }
    }
}
