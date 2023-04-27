package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.DecodedMessage

import java.lang.Exception

class DecodedMessageWrapper {

    companion object {
        fun encode(model: DecodedMessage): String {
            val gson = GsonBuilder().create()
            val message = mapOf(
                "id" to model.id,
                "content" to model.body,
                "senderAddress" to model.senderAddress,
                "sent" to model.sent
            )
            return gson.toJson(message)
        }
    }
}