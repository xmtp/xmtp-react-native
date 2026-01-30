package expo.modules.xmtpreactnativesdk.wrappers

import android.util.Base64
import com.facebook.common.util.Hex
import com.google.gson.GsonBuilder
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.protobuf.ByteString
import org.xmtp.android.library.Client
import org.xmtp.android.library.codecs.Attachment
import org.xmtp.android.library.codecs.AttachmentCodec
import org.xmtp.android.library.codecs.ContentTypeAttachment
import org.xmtp.android.library.codecs.ContentTypeDeleteMessageRequest
import org.xmtp.android.library.codecs.ContentTypeGroupUpdated
import org.xmtp.android.library.codecs.ContentTypeId
import org.xmtp.android.library.codecs.ContentTypeMultiRemoteAttachment
import org.xmtp.android.library.codecs.ContentTypeReaction
import org.xmtp.android.library.codecs.ContentTypeReactionV2
import org.xmtp.android.library.codecs.ContentTypeReadReceipt
import org.xmtp.android.library.codecs.ContentTypeRemoteAttachment
import org.xmtp.android.library.codecs.ContentTypeReply
import org.xmtp.android.library.codecs.ContentTypeText
import org.xmtp.android.library.codecs.EncodedContent
import org.xmtp.android.library.codecs.GroupUpdated
import org.xmtp.android.library.codecs.GroupUpdatedCodec
import org.xmtp.android.library.codecs.MultiRemoteAttachment
import org.xmtp.android.library.codecs.Reaction
import org.xmtp.android.library.codecs.ReactionCodec
import org.xmtp.android.library.codecs.ReactionV2Codec
import org.xmtp.android.library.codecs.ContentTypeLeaveRequest
import org.xmtp.android.library.codecs.DeleteMessageCodec
import org.xmtp.android.library.codecs.DeleteMessageRequest
import org.xmtp.android.library.codecs.LeaveRequest
import org.xmtp.android.library.codecs.LeaveRequestCodec
import org.xmtp.android.library.codecs.ReadReceipt
import org.xmtp.android.library.codecs.ReadReceiptCodec
import org.xmtp.android.library.codecs.RemoteAttachment
import org.xmtp.android.library.codecs.RemoteAttachmentCodec
import org.xmtp.android.library.codecs.MultiRemoteAttachmentCodec
import org.xmtp.android.library.codecs.RemoteAttachmentInfo
import org.xmtp.android.library.codecs.Reply
import org.xmtp.android.library.codecs.ReplyCodec
import org.xmtp.android.library.libxmtp.Reply as LibxmtpReply
import org.xmtp.android.library.codecs.TextCodec
import org.xmtp.android.library.codecs.decoded
import org.xmtp.android.library.codecs.description
import org.xmtp.android.library.codecs.getReactionAction
import org.xmtp.android.library.codecs.getReactionSchema
import org.xmtp.android.library.codecs.id
import org.xmtp.android.library.libxmtp.DecodedMessageV2
import uniffi.xmtpv3.FfiMultiRemoteAttachment
import uniffi.xmtpv3.FfiReactionAction
import uniffi.xmtpv3.FfiReactionPayload
import uniffi.xmtpv3.FfiReactionSchema
import uniffi.xmtpv3.decodeMultiRemoteAttachment
import uniffi.xmtpv3.decodeReaction
import java.net.URL

class ContentJsonV2(
    val message: DecodedMessageV2
) {

    companion object {
        init {
            Client.register(TextCodec())
            Client.register(AttachmentCodec())
            Client.register(ReactionCodec())
            Client.register(RemoteAttachmentCodec())
            Client.register(MultiRemoteAttachmentCodec())
            Client.register(ReplyCodec())
            Client.register(ReadReceiptCodec())
            Client.register(GroupUpdatedCodec())
            Client.register(ReactionV2Codec())
            Client.register(LeaveRequestCodec())
            Client.register(DeleteMessageCodec())
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
            } else if (obj.has("multiRemoteAttachment")) {
                val multiRemoteAttachment = obj.get("multiRemoteAttachment").asJsonObject
                val remoteAttachments = multiRemoteAttachment.get("attachments").asJsonArray
                val attachments: MutableList<RemoteAttachmentInfo> = ArrayList()
                for(attachmentElement: JsonElement in remoteAttachments) {
                    val attachment = attachmentElement.asJsonObject
                    val metadata = EncryptedAttachmentMetadata.fromJsonObj(attachment)
                    val url = URL(attachment.get("url").asString)
                    val remoteAttachmentInfo = RemoteAttachmentInfo(
                        url = url.toString(),
                        contentDigest = metadata.contentDigest,
                        secret = metadata.secret,
                        salt = metadata.salt,
                        nonce = metadata.nonce,
                        scheme = "https://",
                        contentLength = metadata.contentLength.toLong(),
                        filename = metadata.filename,
                    )
                    attachments.add(remoteAttachmentInfo)
                }
                return ContentJson(ContentTypeMultiRemoteAttachment, MultiRemoteAttachment(
                    remoteAttachments = attachments
                ))
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
            } else if (obj.has("reactionV2")) {
                val reaction = obj.get("reactionV2").asJsonObject
                return ContentJson(
                    ContentTypeReactionV2, FfiReactionPayload(
                        reference = reaction.get("reference").asString,
                        action = getReactionV2Action(reaction.get("action").asString.lowercase()),
                        schema = getReactionV2Schema(reaction.get("schema").asString.lowercase()),
                        content = reaction.get("content").asString,
                        // Update if we add referenceInboxId to ../src/lib/types/ContentCodec.ts#L19-L24
                        referenceInboxId = ""
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

        private fun bytesFrom64(bytes64: String): ByteArray = Base64.decode(bytes64, Base64.NO_WRAP)
        fun bytesTo64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    fun toJsonMap(): Map<String, Any?> {
        return when (message.contentTypeId.id) {
            ContentTypeText.id -> mapOf(
                "text" to (message.content<String>()  ?: ""),
            )

            ContentTypeAttachment.id -> {
                val content: Attachment? = message.content<Attachment>()
                return mapOf(
                    "attachment" to mapOf(
                        "filename" to content?.filename,
                        "mimeType" to content?.mimeType,
                        "data" to (content?.data?.toByteArray()?.let { bytesTo64(it) } ?: ""),
                    )
                )
            }

            ContentTypeRemoteAttachment.id -> {
                val content: RemoteAttachment? = message.content<RemoteAttachment>()
                if (content != null) {
                    mapOf(
                        "remoteAttachment" to mapOf(
                            "scheme" to "https://",
                            "url" to content.url.toString(),
                        ) + EncryptedAttachmentMetadata
                            .fromRemoteAttachment(content)
                            .toJsonMap()
                    )
                } else {
                    mapOf("remoteAttachment" to null)
                }
            }

            ContentTypeMultiRemoteAttachment.id -> {
                val multiRemoteAttachment: MultiRemoteAttachment? = message.content<MultiRemoteAttachment>()
                val attachmentMaps = multiRemoteAttachment?.remoteAttachments?.map { attachment ->
                    mapOf(
                        "scheme" to "https://",
                        "url" to attachment.url,
                        "filename" to attachment.filename,
                        "contentLength" to attachment.contentLength.toString(),
                        "contentDigest" to attachment.contentDigest,
                        "secret" to Hex.encodeHex(attachment.secret.toByteArray(), false),
                        "salt" to Hex.encodeHex(attachment.salt.toByteArray(), false),
                        "nonce" to Hex.encodeHex(attachment.nonce.toByteArray(), false)
                    )
                } ?: emptyList()
                mapOf(
                    "multiRemoteAttachment" to mapOf(
                        "attachments" to attachmentMaps
                    )
                )
            }

            ContentTypeReaction.id, ContentTypeReactionV2.id -> {
                message.content<Reaction>()?.let { content ->
                    mapOf(
                        "reaction" to mapOf(
                            "reference" to content.reference,
                            "action" to content.action.javaClass.simpleName.lowercase(),
                            "schema" to content.schema.javaClass.simpleName.lowercase(),
                            "content" to content.content,
                        )
                    )
                } ?: mapOf("reaction" to emptyMap<String, Any>())
            }

            ContentTypeReply.id -> {
                message.content<LibxmtpReply>()?.let { reply ->
                    // LibxmtpReply has: referenceId, content (already decoded Any?), inReplyTo (DecodedMessageV2?)
                    // Serialize the nested content - it's already decoded, so we need to determine its type
                    val nestedContentMap = when (val content = reply.content) {
                        is String -> mapOf("text" to content)
                        else -> {
                            // Try to serialize using Gson for complex types
                            try {
                                val gson = GsonBuilder().create()
                                val jsonElement = gson.toJsonTree(content)
                                if (jsonElement.isJsonObject) {
                                    gson.fromJson<Map<String, Any>>(jsonElement, Map::class.java) ?: emptyMap()
                                } else {
                                    mapOf("content" to content.toString())
                                }
                            } catch (e: Exception) {
                                mapOf("content" to content.toString())
                            }
                        }
                    }
                    mapOf(
                        "reply" to mapOf(
                            "reference" to reply.referenceId,
                            "content" to nestedContentMap
                        )
                    )
                } ?: mapOf("reply" to emptyMap<String, Any>())
            }

            ContentTypeReadReceipt.id -> mapOf(
                "readReceipt" to ""
            )

            ContentTypeGroupUpdated.id -> {
                message.content<GroupUpdated>()?.let { content ->
                    mapOf(
                        "groupUpdated" to mapOf(
                            "initiatedByInboxId" to content.initiatedByInboxId,
                            "membersAdded" to content.addedInboxesList.map {
                                mapOf("inboxId" to it.inboxId)
                            },
                            "membersRemoved" to content.removedInboxesList.map {
                                mapOf("inboxId" to it.inboxId)
                            },
                            "metadataFieldsChanged" to content.metadataFieldChangesList.map {
                                mapOf(
                                    "oldValue" to it.oldValue,
                                    "newValue" to it.newValue,
                                    "fieldName" to it.fieldName,
                                )
                            },
                        )
                    )
                } ?: mapOf("groupUpdated" to emptyMap<String, Any>())
            }

            ContentTypeLeaveRequest.id -> {
                val content: LeaveRequest? = message.content<LeaveRequest>()
                mapOf(
                    "leaveRequest" to mapOf(
                        "authenticatedNote" to (content?.authenticatedNote ?: "")
                    )
                )
            }

           ContentTypeDeleteMessageRequest.id -> {
               val content: DeleteMessageRequest? = message.content<DeleteMessageRequest>()
               mapOf(
                   "deleteMessage" to mapOf(
                       "messageId" to ((content as? DeleteMessageRequest)?.messageId ?: "")
                   )
               )
           }

            else -> {
                // Fallback for unhandled content types
                // DecodedMessageV2 doesn't expose raw encodedContent - content is already decoded via FFI
                // Custom types are handled by FfiDecodedMessageContent.Custom -> encodedContentFromFfi
                // This branch only hits if a new content type is added but not yet handled above
                val content = message.content<Any>()
                if (content != null) {
                    // Try to serialize the decoded content using Gson
                    try {
                        val gson = GsonBuilder().create()
                        val contentJson = gson.toJsonTree(content)
                        mapOf(
                            "unknown" to mapOf(
                                "contentTypeId" to message.contentTypeId.description,
                                "content" to contentJson
                            )
                        )
                    } catch (e: Exception) {
                        // Gson serialization failed, return just the type info
                        mapOf(
                            "unknown" to mapOf(
                                "contentTypeId" to message.contentTypeId.description,
                                "fallback" to (message.fallbackText ?: "Unsupported content type")
                            )
                        )
                    }
                } else {
                    // Content decoding returned null
                    mapOf(
                        "unknown" to mapOf(
                            "contentTypeId" to message.contentTypeId.description,
                            "fallback" to (message.fallbackText ?: "Failed to decode content")
                        )
                    )
                }
            }
        }
    }
}