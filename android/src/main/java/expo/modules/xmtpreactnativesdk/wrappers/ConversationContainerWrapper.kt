package expo.modules.xmtpreactnativesdk.wrappers

import android.util.Base64
import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.Conversation

class ConversationContainerWrapper {

    companion object {
        fun encodeToObj(client: Client, conversation: Conversation): Map<String, Any> {
            when (conversation.version) {
                Conversation.Version.GROUP -> {
                    val group = (conversation as Conversation.Group).group
                    return GroupWrapper.encodeToObj(client, group)
                }
                else -> {
                    return ConversationWrapper.encodeToObj(client, conversation)
                }
            }
        }

        fun encode(client: Client, conversation: Conversation): String {
            val gson = GsonBuilder().create()
            val obj = ConversationContainerWrapper.encodeToObj(client, conversation)
            return gson.toJson(obj)
        }
    }
}
