package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.Conversation

class ConversationContainerWrapper {

    companion object {
        suspend fun encodeToObj(
            client: Client,
            conversation: Conversation,
            conversationParams: ConversationParamsWrapper = ConversationParamsWrapper(),
        ): Map<String, Any?> {
            return when (conversation.version) {
                Conversation.Version.GROUP -> {
                    val group = (conversation as Conversation.Group).group
                    GroupWrapper.encodeToObj(client, group, conversationParams)
                }

                Conversation.Version.DM -> {
                    val dm = (conversation as Conversation.Dm).dm
                    DmWrapper.encodeToObj(client, dm, conversationParams)
                }

                else -> {
                    ConversationWrapper.encodeToObj(client, conversation)
                }
            }
        }

        suspend fun encode(
            client: Client,
            conversation: Conversation,
            conversationParams: ConversationParamsWrapper = ConversationParamsWrapper(),
        ): String {
            val gson = GsonBuilder().create()
            val obj =
                ConversationContainerWrapper.encodeToObj(client, conversation, conversationParams)
            return gson.toJson(obj)
        }
    }
}
