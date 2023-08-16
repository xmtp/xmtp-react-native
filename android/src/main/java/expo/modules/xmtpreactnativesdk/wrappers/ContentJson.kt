package expo.modules.xmtpreactnativesdk.wrappers

import android.util.Base64
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.protobuf.ByteString
import org.xmtp.android.library.Client
import org.xmtp.proto.message.contents.Content.EncodedContent
import org.xmtp.android.library.codecs.decoded
import org.xmtp.android.library.codecs.ContentTypeAttachment
import org.xmtp.android.library.codecs.ContentTypeId
import org.xmtp.android.library.codecs.ContentTypeReaction
import org.xmtp.android.library.codecs.ContentTypeText
import org.xmtp.android.library.codecs.AttachmentCodec
import org.xmtp.android.library.codecs.Attachment
import org.xmtp.android.library.codecs.ContentTypeRemoteAttachment
import org.xmtp.android.library.codecs.ContentTypeReply
import org.xmtp.android.library.codecs.ReactionAction
import org.xmtp.android.library.codecs.ReactionSchema
import org.xmtp.android.library.codecs.ReactionCodec
import org.xmtp.android.library.codecs.Reaction
import org.xmtp.android.library.codecs.RemoteAttachment
import org.xmtp.android.library.codecs.RemoteAttachmentCodec
import org.xmtp.android.library.codecs.Reply
import org.xmtp.android.library.codecs.ReplyCodec
import org.xmtp.android.library.codecs.TextCodec
import org.xmtp.android.library.codecs.id

import java.lang.Exception
import java.net.URL

class ContentJson(
    val type: ContentTypeId,
    val content: Any?,
) {
    constructor(encoded: EncodedContent) : this(
        type = encoded.type,
        content = encoded.decoded(),
    );

    companion object {
        init {
            Client.register(TextCodec())
            Client.register(AttachmentCodec())
            Client.register(ReactionCodec())
            Client.register(RemoteAttachmentCodec())
            Client.register(ReplyCodec())
            // TODO:
            //Client.register(CompositeCodec())
            //Client.register(GroupChatMemberAddedCodec())
            //Client.register(GroupChatTitleChangedCodec())

        }

        fun fromJsonObject(obj: JsonObject): ContentJson {
            if (obj.has("text")) {
                return ContentJson(ContentTypeText, obj.get("text").asString)
            } else if (obj.has("attachment")) {
                val attachment = obj.get("attachment").asJsonObject
                return ContentJson(ContentTypeAttachment, Attachment(
                    filename = attachment.get("filename").asString,
                    mimeType = attachment.get("mimeType").asString,
                    data = ByteString.copyFrom(bytesFrom64(attachment.get("data").asString)),
                ))
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
                return ContentJson(ContentTypeReaction, Reaction(
                    reference = reaction.get("reference").asString,
                    action = ReactionAction.valueOf(reaction.get("action").asString),
                    schema = ReactionSchema.valueOf(reaction.get("schema").asString),
                    content = reaction.get("content").asString,
                ))
            } else if (obj.has("reply")) {
                val reply = obj.get("reply").asJsonObject
                val nested = fromJsonObject(reply.get("content").asJsonObject)
                if (nested.type.id == ContentTypeReply.id) {
                    throw Exception("Reply cannot contain a reply")
                }
                if (nested.content == null) {
                    throw Exception("Bad reply content")
                }
                return ContentJson(ContentTypeReply, Reply(
                    reference = reply.get("reference").asString,
                    content = nested.content,
                    contentType = nested.type,
                ))
            } else {
                throw Exception("Unknown content type")
            }
        }

        fun fromJson(json: String): ContentJson {
            val obj = JsonParser.parseString(json).asJsonObject
            return fromJsonObject(obj);
        }

        fun bytesFrom64(bytes64: String): ByteArray = Base64.decode(bytes64, Base64.DEFAULT)
        fun bytesTo64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.DEFAULT)
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
                    "action" to content.action,
                    "schema" to content.schema,
                    "content" to content.content,
                )
            )

            ContentTypeReply.id -> mapOf(
                "reply" to mapOf(
                    "reference" to (content as Reply).reference,
                    "content" to ContentJson(content.contentType, content.content).toJsonMap(),
                )
            )

            else -> mapOf(
                "unknown" to mapOf(
                    "contentTypeId" to type.id
                )
            )
        }
    }
}
