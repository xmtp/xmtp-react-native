package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.Conversation

class ConversationWrapper {

    companion object {
        fun encode(model: Conversation): String {
            val gson = GsonBuilder().create()
            val conversation = mapOf(
                "topic" to model.topic,
                "peerAddress" to model.peerAddress,
                "version" to if (model.version == Conversation.Version.V1) "v1" else "v2",
                "conversationID" to model.conversationId
            )
            return gson.toJson(conversation)
        }
    }
}