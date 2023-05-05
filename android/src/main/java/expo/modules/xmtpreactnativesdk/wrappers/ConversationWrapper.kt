package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.Conversation

data class ConversationWithClientAddress(
    var clientAddress: String,
    var topic: String,
    var peerAddress: String,
    var version: String,
    var conversationId: String?,
) {
    constructor(client: Client, conversation: Conversation): this(
        clientAddress = client.address,
        topic = conversation.topic,
        peerAddress = conversation.peerAddress,
        version = if (conversation.version == Conversation.Version.V1) "v1" else "v2",
        conversationId = conversation.conversationId)

}

class ConversationWrapper {

    companion object {
        fun encode(model: ConversationWithClientAddress): String {
            val gson = GsonBuilder().create()
            val conversation = mapOf(
                "topic" to model.topic,
                "peerAddress" to model.peerAddress,
                "version" to model.version,
                "conversationID" to model.conversationId
            )
            return gson.toJson(conversation)
        }
    }
}