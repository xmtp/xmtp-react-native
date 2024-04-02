package expo.modules.xmtpreactnativesdk.wrappers

import android.util.Log
import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.codecs.ContentCodec
import org.xmtp.android.library.codecs.ContentTypeReadReceipt
import org.xmtp.android.library.codecs.ContentTypeText
import org.xmtp.android.library.codecs.ReadReceipt
import org.xmtp.android.library.codecs.decoded
import org.xmtp.android.library.codecs.description
import org.xmtp.android.library.messages.DecryptedMessage

class DecodedMessageWrapper {

    companion object {
        fun encode(model: DecryptedMessage): String {
            val gson = GsonBuilder().create()
            val message = encodeMap(model)
            return gson.toJson(message)
        }

        fun encodeMap(model: DecryptedMessage): Map<String, Any> {
            val codec = Client.codecRegistry.find(model.encodedContent.type)
            val fallback = when (codec.contentType) {
                ContentTypeReadReceipt -> {
                    val content = codec.decode(model.encodedContent) as ReadReceipt
                    (codec as ContentCodec<ReadReceipt>).fallback(content).toString()
                }
                ContentTypeText  -> {
                    val content = codec.decode(model.encodedContent) as String
                    (codec as ContentCodec<String>).fallback(content).toString()
                }
                else -> model.encodedContent.fallback
            }
            return mapOf(
                "id" to model.id,
                "topic" to model.topic,
                "contentTypeId" to model.encodedContent.type.description,
                "content" to ContentJson(model.encodedContent).toJsonMap(),
                "senderAddress" to model.senderAddress,
                "sent" to model.sentAt.time,
                "fallback" to fallback
            )
        }
    }
}
