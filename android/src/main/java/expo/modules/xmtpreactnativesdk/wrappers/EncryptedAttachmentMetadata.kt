package expo.modules.xmtpreactnativesdk.wrappers

import com.facebook.common.util.Hex
import com.google.gson.JsonObject
import com.google.protobuf.ByteString
import com.google.protobuf.kotlin.toByteString
import org.xmtp.android.library.codecs.Attachment
import org.xmtp.android.library.codecs.EncryptedEncodedContent
import org.xmtp.android.library.codecs.RemoteAttachment

/**
 * Describes the metadata for an encrypted attachment used to encrypt/decrypt the payload.
 */
class EncryptedAttachmentMetadata(
    val filename: String,
    val secret: ByteString,
    val salt: ByteString,
    val nonce: ByteString,
    val contentDigest: String,
    val contentLength: Int,
) {
    companion object {
        fun fromAttachment(
            attachment: Attachment,
            encrypted: EncryptedEncodedContent
        ) = EncryptedAttachmentMetadata(
            attachment.filename,
            encrypted.secret,
            encrypted.salt,
            encrypted.nonce,
            encrypted.contentDigest,
            attachment.data.size(),
        )

        fun fromRemoteAttachment(
            remoteAttachment: RemoteAttachment,
        ) = EncryptedAttachmentMetadata(
            remoteAttachment.filename ?: "",
            remoteAttachment.secret,
            remoteAttachment.salt,
            remoteAttachment.nonce,
            remoteAttachment.contentDigest,
            remoteAttachment.contentLength ?: 0,
        )

        fun fromJsonObj(
            obj: JsonObject,
        ) = EncryptedAttachmentMetadata(
            obj.get("filename").asString,
            Hex.hexStringToByteArray(obj.get("secret").asString).toByteString(),
            Hex.hexStringToByteArray(obj.get("salt").asString).toByteString(),
            Hex.hexStringToByteArray(obj.get("nonce").asString).toByteString(),
            obj.get("contentDigest").asString,
            obj.get("contentLength")?.asString?.let { Integer.parseInt(it) } ?: 0,
        )
    }

    fun toJsonMap(): Map<String, Any> = mapOf(
        "filename" to filename,
        "secret" to Hex.encodeHex(secret.toByteArray(), false),
        "salt" to Hex.encodeHex(salt.toByteArray(), false),
        "nonce" to Hex.encodeHex(nonce.toByteArray(), false),
        "contentDigest" to contentDigest,
        "contentLength" to contentLength.toString(),
    )
}