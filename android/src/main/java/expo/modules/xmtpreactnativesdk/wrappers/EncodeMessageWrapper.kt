package expo.modules.xmtpreactnativesdk.wrappers

import android.util.Log
import com.daveanthonythomas.moshipack.MoshiPack
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableNativeArray
import org.xmtp.android.library.DecodedMessage

class EncodedMessageWrapper {

    companion object {
        fun encode(model: DecodedMessage): ReadableArray {
            val message = mapOf(
                "id" to model.id,
                "content" to model.encodedContent.toByteArray(),
                "senderAddress" to model.senderAddress.toByteArray(),
                "sent" to model.sent.time.toString()
            )
            val encodedContent = MoshiPack().pack(message).readByteArray()

            val byteArray = WritableNativeArray()
            encodedContent.forEach {
                byteArray.pushString(it.toString())
            }
            return byteArray
        }
    }
}