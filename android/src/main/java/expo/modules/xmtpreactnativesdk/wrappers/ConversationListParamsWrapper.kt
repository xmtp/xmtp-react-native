package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.JsonParser
import org.xmtp.android.library.ConsentState
import org.xmtp.android.library.Conversations

class ConversationListParamsWrapper(
    val createdAfterNs: Long?,
    val createdBeforeNs: Long?,
    val lastActivityAfterNs: Long?,
    val lastActivityBeforeNs: Long?,
    val limit: Int?,
    val consentStates: List<ConsentState>?,
    val orderBy: Conversations.ListConversationsOrderBy?,
) {
    companion object {
        fun conversationListParamsFromJson(paramsJson: String): ConversationListParamsWrapper {
            if (paramsJson.isEmpty()) {
                return ConversationListParamsWrapper(
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                )
            }

            val jsonOptions = JsonParser.parseString(paramsJson).asJsonObject

            val createdAfterNs =
                if (jsonOptions.has("createdAfterNs")) {
                    jsonOptions.get("createdAfterNs").asLong
                } else {
                    null
                }

            val createdBeforeNs =
                if (jsonOptions.has("createdBeforeNs")) {
                    jsonOptions.get("createdBeforeNs").asLong
                } else {
                    null
                }

            val lastActivityAfterNs =
                if (jsonOptions.has("lastActivityAfterNs")) {
                    jsonOptions.get("lastActivityAfterNs").asLong
                } else {
                    null
                }

            val lastActivityBeforeNs =
                if (jsonOptions.has("lastActivityBeforeNs")) {
                    jsonOptions.get("lastActivityBeforeNs").asLong
                } else {
                    null
                }

            val limit =
                if (jsonOptions.has("limit")) {
                    jsonOptions.get("limit").asInt
                } else {
                    null
                }

            val consentStates =
                if (jsonOptions.has("consentStates")) {
                    val statesArray = jsonOptions.getAsJsonArray("consentStates")
                    statesArray.map { state ->
                        when (state.asString.lowercase()) {
                            "allowed" -> ConsentState.ALLOWED
                            "denied" -> ConsentState.DENIED
                            else -> ConsentState.UNKNOWN
                        }
                    }
                } else {
                    null
                }

            val orderBy =
                if (jsonOptions.has("orderBy")) {
                    when (jsonOptions.get("orderBy").asString.lowercase()) {
                        "created_at" -> Conversations.ListConversationsOrderBy.CREATED_AT
                        "last_activity" -> Conversations.ListConversationsOrderBy.LAST_ACTIVITY
                        else -> Conversations.ListConversationsOrderBy.LAST_ACTIVITY
                    }
                } else {
                    null
                }

            return ConversationListParamsWrapper(
                createdAfterNs,
                createdBeforeNs,
                lastActivityAfterNs,
                lastActivityBeforeNs,
                limit,
                consentStates,
                orderBy,
            )
        }
    }
}
