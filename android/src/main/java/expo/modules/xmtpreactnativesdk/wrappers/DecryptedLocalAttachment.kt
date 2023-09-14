package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/**
 * Refers to a decrypted attachment that is stored locally on the device.
 */
class DecryptedLocalAttachment(
    val fileUri: String,
    val mimeType: String,
    val filename: String,
) {
    companion object {
        fun fromJsonObject(obj: JsonObject) = DecryptedLocalAttachment(
            obj.get("fileUri").asString,
            obj.get("mimeType").asString,
            obj.get("filename")?.asString ?: "",
        )

        fun fromJson(json: String): DecryptedLocalAttachment {
            val obj = JsonParser.parseString(json).asJsonObject
            return fromJsonObject(obj);
        }
    }

    fun toJsonMap(): Map<String, Any> = mapOf(
        "fileUri" to fileUri,
        "mimeType" to mimeType,
        "filename" to filename,
    )

    fun toJson(): String = GsonBuilder().create().toJson(toJsonMap())
}