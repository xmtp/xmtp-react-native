package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.codecs.description
import org.xmtp.android.library.messages.DecryptedMessage

class DecodedMessageWrapper {

    companion object {
        fun encode(model: DecryptedMessage): String {
            val gson = GsonBuilder().create()
            val message = encodeMap(model)
            return gson.toJson(message)
        }

        fun encodeMap(model: DecryptedMessage): Map<String, Any?> {
            // Kotlin/Java Protos don't support null values and will always put the default ""
            // Check if there is a fallback, if there is then make it the set fallback, if not null
            val fallback = if (model.encodedContent.hasFallback()) model.encodedContent.fallback else null
            return mapOf(
                "id" to model.id,
                "topic" to model.topic,
                "contentTypeId" to model.encodedContent.type.description,
                "content" to ContentJson(model.encodedContent).toJsonMap(),
                "senderAddress" to model.senderAddress,
                "sent" to model.sentAt.time,
                "fallback" to fallback,
                "deliveryStatus" to model.deliveryStatus.toString().lowercase()
            )
        }
    }
}
