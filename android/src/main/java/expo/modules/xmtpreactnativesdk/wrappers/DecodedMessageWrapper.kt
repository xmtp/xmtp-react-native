package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.DecodedMessage
import org.xmtp.android.library.codecs.id

class DecodedMessageWrapper {

    companion object {
        fun encode(model: DecodedMessage, topic: String): String {
            val gson = GsonBuilder().create()
            val message = encodeMap(model, topic)
            return gson.toJson(message)
        }

        fun encodeMap(model: DecodedMessage, topic: String): Map<String, Any> = mapOf(
            "id" to model.id,
            "topic" to topic,
            "contentTypeId" to model.encodedContent.type.id,
            "content" to ContentJson(model.encodedContent).toJsonMap(),
            "senderAddress" to model.senderAddress,
            "sent" to model.sent.time,
        )
    }
}
