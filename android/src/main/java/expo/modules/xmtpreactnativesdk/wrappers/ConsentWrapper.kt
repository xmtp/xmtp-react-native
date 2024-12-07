package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.ConsentRecord
import org.xmtp.android.library.ConsentState

class ConsentWrapper {

    companion object {
        fun encode(model: ConsentRecord): String {
            val gson = GsonBuilder().create()
            val message = encodeMap(model)
            return gson.toJson(message)
        }

        fun encodeMap(model: ConsentRecord): Map<String, Any> = mapOf(
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