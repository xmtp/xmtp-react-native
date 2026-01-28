package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.codecs.description
import org.xmtp.android.library.libxmtp.DecodedMessage
import org.xmtp.android.library.libxmtp.DecodedMessageV2

class MessageWrapper {

    companion object {
        fun encode(model: DecodedMessage): String {
            val gson = GsonBuilder().create()
            val message = encodeMap(model)
            return gson.toJson(message)
        }

        fun encode(model: DecodedMessageV2): String {
            val gson = GsonBuilder().create()
            val message = encodeMap(model)
            return gson.toJson(message)
        }

        fun encodeMap(model: DecodedMessage): Map<String, Any?> {
            // Kotlin/Java Protos don't support null values and will always put the default ""
            // Check if there is a fallback, if there is then make it the set fallback, if not null
            val fallback = if (model.encodedContent.hasFallback()) model.encodedContent.fallback else null
            return mapOf(
                "id" to model.id,
                "topic" to model.topic,
                "contentTypeId" to model.encodedContent.type.description,
                "content" to ContentJson(model.encodedContent).toJsonMap(),
                "senderInboxId" to model.senderInboxId,
                "sentNs" to model.sentAtNs,
                "fallback" to fallback,
                "deliveryStatus" to model.deliveryStatus.toString(),
                "childMessages" to model.childMessages?.map { childMessage -> encodeMap(childMessage) }
            )
        }

        fun encodeMap(model: DecodedMessageV2): Map<String, Any?> {
            // reactions is List<DecodedMessageV2> (not nullable)
            val reactions = model.reactions.map { reaction -> encodeMap(reaction) }
            return mapOf(
                "id" to model.id,
                "conversationId" to model.conversationId,
                "contentTypeId" to model.contentTypeId.description,
                "nativeContent" to ContentJsonV2(model).toJsonMap(),
                "senderInboxId" to model.senderInboxId,
                "sentAt" to (model.sentAtNs / 1_000_000),
                "sentAtNs" to model.sentAtNs,
                "insertedAtNs" to model.insertedAtNs,
                "expiresAtNs" to model.expiresAtNs,
                "expiresAt" to model.expiresAt?.time,  // Date.time gives milliseconds
                "fallbackText" to model.fallbackText,
                "deliveryStatus" to model.deliveryStatus.toString(),
                "reactions" to reactions,
                "hasReactions" to model.hasReactions,
                "reactionCount" to model.reactionCount.toLong()  // ULong -> Long for JSON
            )
        }
    }
}
