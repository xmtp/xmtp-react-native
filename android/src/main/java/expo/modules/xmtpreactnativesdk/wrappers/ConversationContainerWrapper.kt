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
                    return GroupWrapper.encodeToObj(client, group, Base64.encodeToString(group.id,
                        Base64.NO_WRAP
                    ))
                }
                else -> {
                    return ConversationWrapper.encodeToObj(client, conversation)
                }
            }
        }
    }
}
