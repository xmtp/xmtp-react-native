package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.DecodedMessage

class DecodedMessageWrapper {

    companion object {
        fun encode(model: DecodedMessage): String {
            val gson = GsonBuilder().create()
            val message = encodeMap(model)
            return gson.toJson(message)
        }

        fun encodeMap(model: DecodedMessage): Map<String, Any> = mapOf(
            "id" to model.id,
            "content" to ContentJson(model.encodedContent).toJsonMap(),
            "senderAddress" to model.senderAddress,
            "sent" to model.sent.getTime(),
        )
    }
}
