package com.xmtp.wrappers

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
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

      fun encodeMap(model: DecryptedMessage): WritableMap {
        val result = Arguments.createMap().apply {
          putString("id", model.id)
          putString("topic", model.topic)
          putString("contentTypeId", model.encodedContent.type.description)
          putMap("content", ContentJson(model.encodedContent).toWritableMap())
          putString("senderAddress", model.senderAddress)
          putDouble("sent", model.sentAt.time.toDouble())
          putString("fallback", model.encodedContent.fallback)
        }
        return result
      }
    }
}
