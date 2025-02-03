package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.JsonParser

class CreateGroupParamsWrapper(
    val groupName: String,
    val groupImageUrlSquare: String,
    val groupDescription: String,
) {
    companion object {
        fun createGroupParamsFromJson(authParams: String): CreateGroupParamsWrapper {
            val jsonOptions = JsonParser.parseString(authParams).asJsonObject
            return CreateGroupParamsWrapper(
                if (jsonOptions.has("name")) jsonOptions.get("name").asString else "",
                if (jsonOptions.has("imageUrlSquare")) jsonOptions.get("imageUrlSquare").asString else "",
                if (jsonOptions.has("description")) jsonOptions.get("description").asString else "",
            )
        }
    }
}
