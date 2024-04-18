package expo.modules.xmtpreactnativesdk.wrappers

import android.util.Base64
import com.google.gson.GsonBuilder
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.protobuf.ByteString
import org.xmtp.android.library.Client
import org.xmtp.android.library.codecs.Attachment
import org.xmtp.android.library.codecs.AttachmentCodec
import org.xmtp.android.library.codecs.ContentTypeAttachment
import org.xmtp.android.library.codecs.ContentTypeId
import org.xmtp.android.library.codecs.ContentTypeReaction
import org.xmtp.android.library.codecs.ContentTypeReadReceipt
import org.xmtp.android.library.codecs.ContentTypeRemoteAttachment
import org.xmtp.android.library.codecs.ContentTypeReply
import org.xmtp.android.library.codecs.ContentTypeText
import org.xmtp.android.library.codecs.EncodedContent
import org.xmtp.android.library.codecs.Reaction
import org.xmtp.android.library.codecs.ReactionCodec
import org.xmtp.android.library.codecs.ReadReceipt
import org.xmtp.android.library.codecs.ReadReceiptCodec
import org.xmtp.android.library.codecs.RemoteAttachment
import org.xmtp.android.library.codecs.RemoteAttachmentCodec
import org.xmtp.android.library.codecs.Reply
import org.xmtp.android.library.codecs.ReplyCodec
import org.xmtp.android.library.codecs.TextCodec
import org.xmtp.android.library.codecs.decoded
import org.xmtp.android.library.codecs.description
import org.xmtp.android.library.codecs.getReactionAction
import org.xmtp.android.library.codecs.getReactionSchema
import org.xmtp.android.library.codecs.id
import java.net.URL

class ContentJson(
    val type: ContentTypeId,
    val content: Any?,
    private val encodedContent: EncodedContent? = null,
) {
    constructor(encoded: EncodedContent) : this(
        type = encoded.type,
        content = encoded.decoded(),
        encodedContent = encoded
    );

    companion object {
        init {
            Client.register(TextCodec())
            Client.register(AttachmentCodec())
            Client.register(ReactionCodec())
            Client.register(RemoteAttachmentCodec())
            Client.register(ReplyCodec())
            Client.register(ReadReceiptCodec())
        }

        fun fromJsonObject(obj: JsonObject): ContentJson {
            if (obj.has("text")) {
                return ContentJson(ContentTypeText, obj.get("text").asString)
            } else if (obj.has("attachment")) {
                val attachment = obj.get("attachment").asJsonObject
                return ContentJson(
                    ContentTypeAttachment, Attachment(
                        filename = attachment.get("filename").asString,
                        mimeType = attachment.get("mimeType").asString,
                        data = ByteString.copyFrom(bytesFrom64(attachment.get("data").asString)),
                    )
                )
            } else if (obj.has("remoteAttachment")) {
                val remoteAttachment = obj.get("remoteAttachment").asJsonObject
                val metadata = EncryptedAttachmentMetadata.fromJsonObj(remoteAttachment)
                val url = URL(remoteAttachment.get("url").asString)
                return ContentJson(
                    ContentTypeRemoteAttachment, RemoteAttachment(
                        url = url,
                        contentDigest = metadata.contentDigest,
                        secret = metadata.secret,
                        salt = metadata.salt,
                        nonce = metadata.nonce,
                        scheme = "https://",
                        contentLength = metadata.contentLength,
                        filename = metadata.filename,
                    )
                )
            } else if (obj.has("reaction")) {
                val reaction = obj.get("reaction").asJsonObject
                return ContentJson(
                    ContentTypeReaction, Reaction(
                        reference = reaction.get("reference").asString,
                        action = getReactionAction(reaction.get("action").asString.lowercase()),
                        schema = getReactionSchema(reaction.get("schema").asString.lowercase()),
                        content = reaction.get("content").asString,
                    )
                )
            } else if (obj.has("reply")) {
                val reply = obj.get("reply").asJsonObject
                val nested = fromJsonObject(reply.get("content").asJsonObject)
                if (nested.type.id == ContentTypeReply.id) {
                    throw Exception("Reply cannot contain a reply")
                }
                if (nested.content == null) {
                    throw Exception("Bad reply content")
                }
                return ContentJson(
                    ContentTypeReply, Reply(
                        reference = reply.get("reference").asString,
                        content = nested.content,
                        contentType = nested.type,
                    )
                )
            } else if (obj.has("readReceipt")) {
                return ContentJson(ContentTypeReadReceipt, ReadReceipt)
            } else {
                throw Exception("Unknown content type")
            }
        }

        fun fromJson(json: String): ContentJson {
            val obj = JsonParser.parseString(json).asJsonObject
            return fromJsonObject(obj);
        }

        fun bytesFrom64(bytes64: String): ByteArray = Base64.decode(bytes64, Base64.NO_WRAP)
        fun bytesTo64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    fun toJsonMap(): Map<String, Any> {
        return when (type.id) {
            ContentTypeText.id -> mapOf(
                "text" to (content as String? ?: ""),
            )

            ContentTypeAttachment.id -> mapOf(
                "attachment" to mapOf(
                    "filename" to (content as Attachment).filename,
                    "mimeType" to content.mimeType,
                    "data" to bytesTo64(content.data.toByteArray()),
                )
            )

            ContentTypeRemoteAttachment.id -> mapOf(
                "remoteAttachment" to mapOf(
                    "scheme" to "https://",
                    "url" to (content as RemoteAttachment).url.toString(),
                ) + EncryptedAttachmentMetadata
                    .fromRemoteAttachment(content)
                    .toJsonMap()
            )

            ContentTypeReaction.id -> mapOf(
                "reaction" to mapOf(
                    "reference" to (content as Reaction).reference,
                    "action" to content.action.javaClass.simpleName.lowercase(),
                    "schema" to content.schema.javaClass.simpleName.lowercase(),
                    "content" to content.content,
                )
            )

            ContentTypeReply.id -> mapOf(
                "reply" to mapOf(
                    "reference" to (content as Reply).reference,
                    "content" to ContentJson(
                        content.contentType,
                        content.content,
                        encodedContent
                    ).toJsonMap(),
                    "contentType" to content.contentType.description
                )
            )

            ContentTypeReadReceipt.id -> mapOf(
                "readReceipt" to ""
            )

            else -> {
                val json = JsonObject()
                encodedContent?.let {
                    val typeJson = JsonObject()
                    typeJson.addProperty("authorityId", encodedContent.type.authorityId)
                    typeJson.addProperty("typeId", encodedContent.type.typeId)
                    typeJson.addProperty("versionMajor", encodedContent.type.versionMajor)
                    typeJson.addProperty("versionMinor", encodedContent.type.versionMinor)
                    val parameters = GsonBuilder().create().toJson(encodedContent.parametersMap)

                    json.addProperty("fallback", encodedContent.fallback)
                    json.add("parameters", JsonParser.parseString(parameters))
                    json.add("type", typeJson)
                    json.addProperty("content", bytesTo64(encodedContent.content.toByteArray()))

                }
                val encodedContentJSON = json.toString()
                if (encodedContentJSON.isNotBlank()) {
                    mapOf("encoded" to encodedContentJSON)
                } else {
                    mapOf(
                        "unknown" to mapOf(
                            "contentTypeId" to type.description
                        )
                    )
                }
            }
        }
    }
}