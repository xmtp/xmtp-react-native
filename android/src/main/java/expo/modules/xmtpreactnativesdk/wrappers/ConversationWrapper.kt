package expo.modules.xmtpreactnativesdk.wrappers

import android.util.Base64
import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.Conversation

class ConversationWrapper {

    companion object {
        fun encodeToObj(client: Client, conversation: Conversation): Map<String, Any> {
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
                "keyMaterial" to (conversation.keyMaterial?.let { Base64.encodeToString(it, Base64.NO_WRAP) } ?: "")
            )
        }

        fun encode(client: Client, conversation: Conversation): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(client, conversation)
            return gson.toJson(obj)
        }
    }
}