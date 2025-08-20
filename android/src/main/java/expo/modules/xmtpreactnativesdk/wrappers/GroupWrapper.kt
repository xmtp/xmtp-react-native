package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import com.google.gson.JsonParser
import org.xmtp.android.library.Client
import org.xmtp.android.library.ConsentState
import org.xmtp.android.library.Group

class GroupWrapper {

    companion object {
        // The String values in this function should match xmtp-react-native/src/lib/Group.ts: GroupParams
        suspend fun encodeToObj(
            client: Client,
            group: Group,
            groupParams: ConversationParamsWrapper = ConversationParamsWrapper(),
        ): Map<String, Any> {
            return buildMap {
                put("clientInboxId", client.inboxId)
                put("id", group.id)
                put("createdAt", group.createdAt.time)
                put("version", "GROUP")
                put("topic", group.topic)
                put("commitLogForkStatus", ConversationDebugInfoWrapper.commitLogForkStatusToString(group.commitLogForkStatus()))
                if (groupParams.isActive) put("isActive", group.isActive())
                if (groupParams.addedByInboxId) put("addedByInboxId", group.addedByInboxId())
                if (groupParams.name) put("name", group.name)
                if (groupParams.imageUrl) put("imageUrl", group.imageUrl)
                if (groupParams.description) put("description", group.description)
                if (groupParams.consentState) {
                    put("consentState", consentStateToString(group.consentState()))
                }
                if (groupParams.lastMessage) {
                    val lastMessage = group.lastMessage()
                    if (lastMessage != null) {
                        put("lastMessage", MessageWrapper.encode(lastMessage))
                    }
                }
            }
        }

        suspend fun encode(
            client: Client,
            group: Group,
            groupParams: ConversationParamsWrapper = ConversationParamsWrapper(),
        ): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(client, group, groupParams)
            return gson.toJson(obj)
        }
    }
}

fun consentStateToString(state: ConsentState): String {
    return when (state) {
        ConsentState.ALLOWED -> "allowed"
        ConsentState.DENIED -> "denied"
        ConsentState.UNKNOWN -> "unknown"
    }
}

class ConversationParamsWrapper(
    val isActive: Boolean = true,
    val addedByInboxId: Boolean = true,
    val name: Boolean = true,
    val imageUrl: Boolean = true,
    val description: Boolean = true,
    val consentState: Boolean = true,
    val lastMessage: Boolean = false,
) {
    companion object {
        fun conversationParamsFromJson(conversationParams: String): ConversationParamsWrapper {
            if (conversationParams.isEmpty()) return ConversationParamsWrapper()
            val jsonOptions = JsonParser.parseString(conversationParams).asJsonObject
            return ConversationParamsWrapper(
                if (jsonOptions.has("isActive")) jsonOptions.get("isActive").asBoolean else true,
                if (jsonOptions.has("addedByInboxId")) jsonOptions.get("addedByInboxId").asBoolean else true,
                if (jsonOptions.has("name")) jsonOptions.get("name").asBoolean else true,
                if (jsonOptions.has("imageUrl")) jsonOptions.get("imageUrl").asBoolean else true,
                if (jsonOptions.has("description")) jsonOptions.get("description").asBoolean else true,
                if (jsonOptions.has("consentState")) jsonOptions.get("consentState").asBoolean else true,
                if (jsonOptions.has("lastMessage")) jsonOptions.get("lastMessage").asBoolean else false,

                )
        }
    }
}

