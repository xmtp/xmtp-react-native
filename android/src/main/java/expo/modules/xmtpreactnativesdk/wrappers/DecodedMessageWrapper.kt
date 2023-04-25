package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.DecodedMessage

import java.lang.Exception

class DecodedMessageWrapper {

    companion object {
        fun encode(model: DecodedMessage): String {
            val gson = GsonBuilder().create()
            val message = mapOf(
                Pair("id", model.id),
                Pair(
                    "content", (try {
                        model.content()
                    } catch (e: Exception) {
                        null
                    }) ?: model.fallbackContent
                ),
                Pair("senderAddress", model.senderAddress),
                Pair("sent", model.sent)
            )
            return gson.toJson(message)
        }
    }
}