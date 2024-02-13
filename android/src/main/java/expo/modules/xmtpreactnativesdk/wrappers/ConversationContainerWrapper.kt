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
                    return mapOf(
                        "clientAddress" to client.address,
                        "id" to conversation.topic,
                        "createdAt" to conversation.createdAt.time,
                        "peerAddresses" to conversation.peerAddresses,
                        "version" to "group",
                        "topic" to conversation.topic
                    )
                }
                else -> {
                    val context = when (conversation.version) {
                        Conversation.Version.V2 -> mapOf<String, Any>(
                            "conversationID" to (conversation.conversationId ?: ""),
                            // TODO: expose the context/metadata explicitly in xmtp-android
                            "metadata" to conversation.toTopicData().invitation.context.metadataMap,
                        )

                        else -> mapOf()
                    }
                    return mapOf(
                        "clientAddress" to client.address,
                        "createdAt" to conversation.createdAt.time,
                        "context" to context,
                        "topic" to conversation.topic,
                        "peerAddress" to conversation.peerAddress,
                        "version" to if (conversation.version == Conversation.Version.V1) "v1" else "v2",
                        "conversationID" to (conversation.conversationId ?: ""),
                        "keyMaterial" to Base64.encodeToString(conversation.keyMaterial, Base64.NO_WRAP)
                    )
                }
            }
        }
    }
}
