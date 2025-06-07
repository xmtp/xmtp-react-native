package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import com.google.gson.JsonParser
import org.xmtp.android.library.ConsentRecord
import org.xmtp.android.library.ConsentState
import org.xmtp.android.library.EntryType
import org.xmtp.android.library.XMTPException

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

        fun getConsentState(stateString: String): ConsentState {
            return when (stateString) {
                "allowed" -> ConsentState.ALLOWED
                "denied" -> ConsentState.DENIED
                else -> ConsentState.UNKNOWN
            }
        }

        fun getConsentStates(stateStrings: List<String>): List<ConsentState> {
            return stateStrings.map { stateString ->
                getConsentState(stateString)
            }
        }

        fun getEntryType(entryString: String): EntryType {
            return when (entryString) {
                "conversation_id" -> EntryType.CONVERSATION_ID
                "inbox_id" -> EntryType.INBOX_ID
                else -> throw XMTPException("Invalid entry type: $entryString")
            }
        }

        fun consentRecordFromJson(params: String): ConsentRecord {
            val jsonOptions = JsonParser.parseString(params).asJsonObject
            return ConsentRecord(
                jsonOptions.get("value").asString,
                getEntryType(jsonOptions.get("entryType").asString),
                getConsentState(jsonOptions.get("state").asString)
            )
        }
    }
}