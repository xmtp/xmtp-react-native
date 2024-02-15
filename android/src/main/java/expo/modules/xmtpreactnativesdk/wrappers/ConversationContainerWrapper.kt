package expo.modules.xmtpreactnativesdk.wrappers

import android.util.Base64
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
    }
}
