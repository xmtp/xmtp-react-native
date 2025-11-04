package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.JsonParser

class MessageQueryParamsWrapper(
    val limit: Int?,
    val beforeNs: Long?,
    val afterNs: Long?,
    val direction: String?,
    val excludeContentTypes: List<String>?,
    val excludeSenderInboxIds: List<String>?,
) {
    companion object {
        fun messageQueryParamsFromJson(paramsJson: String): MessageQueryParamsWrapper {
            if (paramsJson.isEmpty()) {
                return MessageQueryParamsWrapper(
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                )
            }

            val jsonOptions = JsonParser.parseString(paramsJson).asJsonObject

            val limit =
                if (jsonOptions.has("limit")) {
                    jsonOptions.get("limit").asInt
                } else {
                    null
                }

            val beforeNs =
                if (jsonOptions.has("beforeNs")) {
                    jsonOptions.get("beforeNs").asLong
                } else {
                    null
                }

            val afterNs =
                if (jsonOptions.has("afterNs")) {
                    jsonOptions.get("afterNs").asLong
                } else {
                    null
                }

            val direction =
                if (jsonOptions.has("direction")) {
                    jsonOptions.get("direction").asString
                } else {
                    null
                }

            val excludeContentTypes =
                if (jsonOptions.has("excludeContentTypes")) {
                    val typesArray = jsonOptions.getAsJsonArray("excludeContentTypes")
                    typesArray.map { it.asString }
                } else {
                    null
                }

            val excludeSenderInboxIds =
                if (jsonOptions.has("excludeSenderInboxIds")) {
                    val idsArray = jsonOptions.getAsJsonArray("excludeSenderInboxIds")
                    idsArray.map { it.asString }
                } else {
                    null
                }

            return MessageQueryParamsWrapper(
                limit,
                beforeNs,
                afterNs,
                direction,
                excludeContentTypes,
                excludeSenderInboxIds,
            )
        }
    }
}
