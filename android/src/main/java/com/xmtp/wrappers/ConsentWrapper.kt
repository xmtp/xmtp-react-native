package com.xmtp.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.ConsentListEntry
import org.xmtp.android.library.ConsentState
import org.xmtp.android.library.codecs.description
import org.xmtp.android.library.messages.DecryptedMessage

class ConsentWrapper {

    companion object {
        fun encode(model: ConsentListEntry): String {
            val gson = GsonBuilder().create()
            val message = encodeMap(model)
            return gson.toJson(message)
        }

        fun encodeMap(model: ConsentListEntry): Map<String, Any> = mapOf(
            "type" to model.entryType.name.lowercase(),
            "value" to model.value.lowercase(),
            "state" to consentStateToString(model.consentType),
        )

        fun consentStateToString(state: ConsentState): String {
            return when (state) {
                ConsentState.ALLOWED -> "allowed"
                ConsentState.DENIED -> "denied"
                ConsentState.UNKNOWN -> "unknown"
            }
        }
    }
}
