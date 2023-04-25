package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.Conversation

class ConversationWrapper {

    companion object {
        fun encode(model: Conversation): String {
            val gson = GsonBuilder().create()
            val conversation = mapOf(
                Pair("topic", model.topic),
                Pair("peerAddress", model.peerAddress),
                Pair("version", if (model.version == Conversation.Version.V1) "v1" else "v2"),
                Pair("conversationID", model.conversationId)
            )
            return gson.toJson(conversation)
        }
    }
}