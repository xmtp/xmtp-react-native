package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.Conversation

class ConversationWrapper {
    companion object {
        suspend fun encodeToObj(
            client: Client,
            conversation: Conversation,
            conversationParams: ConversationParamsWrapper = ConversationParamsWrapper(),
        ): Map<String, Any?> =
            when (conversation.type) {
                Conversation.Type.GROUP -> {
                    val group = (conversation as Conversation.Group).group
                    GroupWrapper.encodeToObj(client, group, conversationParams)
                }

                Conversation.Type.DM -> {
                    val dm = (conversation as Conversation.Dm).dm
                    DmWrapper.encodeToObj(client, dm, conversationParams)
                }
            }

        suspend fun encode(
            client: Client,
            conversation: Conversation,
            conversationParams: ConversationParamsWrapper = ConversationParamsWrapper(),
        ): String {
            val gson = GsonBuilder().create()
            val obj =
                encodeToObj(client, conversation, conversationParams)
            return gson.toJson(obj)
        }
    }
}
