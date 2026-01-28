package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.JsonParser

class EnrichedMessageQueryParamsWrapper(
    val limit: Int?,
    val beforeNs: Long?,
    val afterNs: Long?,
    val direction: String?,
    val excludeSenderInboxIds: List<String>?,
    val deliveryStatus: String?,
    val insertedAfterNs: Long?,
    val insertedBeforeNs: Long?,
    val sortBy: String?,
) {
    companion object {
        fun fromJson(paramsJson: String): EnrichedMessageQueryParamsWrapper {
            if (paramsJson.isEmpty()) {
                return EnrichedMessageQueryParamsWrapper(
                    limit = null,
                    beforeNs = null,
                    afterNs = null,
                    direction = null,
                    excludeSenderInboxIds = null,
                    deliveryStatus = null,
                    insertedAfterNs = null,
                    insertedBeforeNs = null,
                    sortBy = null,
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

            val excludeSenderInboxIds =
                if (jsonOptions.has("excludeSenderInboxIds")) {
                    val idsArray = jsonOptions.getAsJsonArray("excludeSenderInboxIds")
                    idsArray.map { it.asString }
                } else {
                    null
                }

            val deliveryStatus =
                if (jsonOptions.has("deliveryStatus")) {
                    jsonOptions.get("deliveryStatus").asString
                } else {
                    null
                }

            val insertedAfterNs =
                if (jsonOptions.has("insertedAfterNs")) {
                    jsonOptions.get("insertedAfterNs").asLong
                } else {
                    null
                }

            val insertedBeforeNs =
                if (jsonOptions.has("insertedBeforeNs")) {
                    jsonOptions.get("insertedBeforeNs").asLong
                } else {
                    null
                }

            val sortBy =
                if (jsonOptions.has("sortBy")) {
                    jsonOptions.get("sortBy").asString
                } else {
                    null
                }

            return EnrichedMessageQueryParamsWrapper(
                limit = limit,
                beforeNs = beforeNs,
                afterNs = afterNs,
                direction = direction,
                excludeSenderInboxIds = excludeSenderInboxIds,
                deliveryStatus = deliveryStatus,
                insertedAfterNs = insertedAfterNs,
                insertedBeforeNs = insertedBeforeNs,
                sortBy = sortBy,
            )
        }
    }
}
