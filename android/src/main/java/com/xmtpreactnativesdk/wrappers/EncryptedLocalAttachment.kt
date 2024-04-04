package com.xmtpreactnativesdk.wrappers

import android.net.Uri
import com.google.gson.GsonBuilder
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.xmtp.android.library.codecs.Attachment
import org.xmtp.android.library.codecs.EncryptedEncodedContent

/**
 * Refers to an encrypted attachment that is stored locally on the device
 * alongside the metadata that can be used to encrypt/decrypt it.
 */
class EncryptedLocalAttachment(
    val encryptedLocalFileUri: String,
    val metadata: EncryptedAttachmentMetadata,
) {
    companion object {
        fun from(
            attachment: Attachment,
            encrypted: EncryptedEncodedContent,
            encryptedFile: Uri,
        ) = EncryptedLocalAttachment(
            encryptedFile.toString(),
            EncryptedAttachmentMetadata.fromAttachment(
                attachment,
                encrypted
            )
        )

        fun fromJsonObject(obj: JsonObject) = EncryptedLocalAttachment(
            obj.get("encryptedLocalFileUri").asString,
            EncryptedAttachmentMetadata.fromJsonObj(obj.get("metadata").asJsonObject),
        )

        fun fromJson(json: String): EncryptedLocalAttachment {
            val obj = JsonParser.parseString(json).asJsonObject
            return fromJsonObject(obj);
        }
    }

    fun toJsonMap(): Map<String, Any> = mapOf(
        "encryptedLocalFileUri" to encryptedLocalFileUri,
        "metadata" to metadata.toJsonMap()
    )

    fun toJson(): String = GsonBuilder().create().toJson(toJsonMap())
}
