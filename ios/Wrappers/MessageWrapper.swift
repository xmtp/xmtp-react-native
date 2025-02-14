import Foundation
import XMTP
import LibXMTP

// Wrapper around XMTP.DecodedMessage to allow passing these objects back
// into react native.
struct MessageWrapper {
	static func encodeToObj(_ model: XMTP.Message) throws -> [String: Any] {
    // Swift Protos don't support null values and will always put the default ""
    // Check if there is a fallback, if there is then make it the set fallback, if not null
		let fallback = try model.encodedContent.hasFallback ? model.encodedContent.fallback : nil
		return [
			"id": model.id,
			"topic": model.topic,
			"contentTypeId": try model.encodedContent.type.description,
			"content": try ContentJson.fromEncoded(model.encodedContent).toJsonMap() as Any,
			"senderInboxId": model.senderInboxId,
			"sentNs": model.sentAtNs,
			"fallback": fallback,
			"deliveryStatus": model.deliveryStatus.rawValue.uppercased(),
            "childMessages": model.childMessages?.map { childMessage in
                try? encodeToObj(childMessage)
            }
        ]
	}

	static func encode(_ model: XMTP.Message) throws -> String {
		let obj = try encodeToObj(model)
		return try obj.toJson()
	}
}

// NOTE: cribbed from xmtp-ios to make visible here.
extension ContentTypeID {
	var id: String {
		"\(authorityID):\(typeID)"
	}
}

struct ContentJson {
	var type: ContentTypeID
	var content: Any
	var encodedContent: EncodedContent?

	static var codecs: [any ContentCodec] = [
		TextCodec(),
		ReactionCodec(),
		ReactionV2Codec(),
		AttachmentCodec(),
		ReplyCodec(),
		RemoteAttachmentCodec(),
		MultiRemoteAttachmentCodec(),
		ReadReceiptCodec(),
		GroupUpdatedCodec(),
	]

	static func initCodecs() {
		codecs.forEach { codec in Client.register(codec: codec) }
	}

	enum Error: Swift.Error {
		case unknownContentType, badAttachmentData, badReplyContent, badRemoteAttachmentMetadata
	}

	static func fromEncoded(_ encoded: XMTP.EncodedContent) throws -> ContentJson {
		return try ContentJson(type: encoded.type, content: encoded.decoded(), encodedContent: encoded)
	}

	static func fromJsonObj(_ obj: [String: Any]) throws -> ContentJson {
		if let text = obj["text"] as? String {
			return ContentJson(type: ContentTypeText, content: text)
		} else if let reaction = obj["reaction"] as? [String: Any] {
			return ContentJson(type: ContentTypeReaction, content: Reaction(
				reference: reaction["reference"] as? String ?? "",
				action: ReactionAction(rawValue: reaction["action"] as? String ?? ""),
				content: reaction["content"] as? String ?? "",
				schema: ReactionSchema(rawValue: reaction["schema"] as? String ?? "")
			))
		} else if let reaction = obj["reactionV2"] as? [String: Any] {
            return ContentJson(type: ContentTypeReactionV2, content: FfiReaction(
				reference: reaction["reference"] as? String ?? "",
				// Update if we add referenceInboxId to ../src/lib/types/ContentCodec.ts#L19-L24
                referenceInboxId: "",
				action: ReactionV2Action.fromString(reaction["action"] as? String ?? ""),
				content: reaction["content"] as? String ?? "",
				schema: ReactionV2Schema.fromString(reaction["schema"] as? String ?? "")
			))
		}else if let reply = obj["reply"] as? [String: Any] {
			guard let nestedContent = reply["content"] as? [String: Any] else {
				throw Error.badReplyContent
			}
			guard let nested = try? fromJsonObj(nestedContent) else {
				throw Error.badReplyContent
			}
			return ContentJson(type: ContentTypeReply, content: Reply(
				reference: reply["reference"] as? String ?? "",
				content: nested.content,
				contentType: nested.type
			))
		} else if let attachment = obj["attachment"] as? [String: Any] {
			guard let data = Data(base64Encoded: (attachment["data"] as? String) ?? "") else {
				throw Error.badAttachmentData
			}
			return ContentJson(type: ContentTypeAttachment, content: Attachment(
				filename: attachment["filename"] as? String ?? "",
				mimeType: attachment["mimeType"] as? String ?? "",
				data: data
			))
		} else if let remoteAttachment = obj["remoteAttachment"] as? [String: Any] {
			guard let metadata = try? EncryptedAttachmentMetadata.fromJsonObj(remoteAttachment) else {
				throw Error.badRemoteAttachmentMetadata
			}
			guard var content = try? RemoteAttachment(
				url: remoteAttachment["url"] as? String ?? "",
				contentDigest: metadata.contentDigest,
				secret: metadata.secret,
				salt: metadata.salt,
				nonce: metadata.nonce,
				scheme: RemoteAttachment.Scheme.https
			) else {
				throw Error.badRemoteAttachmentMetadata
			}
			content.filename = metadata.filename
			content.contentLength = metadata.contentLength
			return ContentJson(type: ContentTypeRemoteAttachment, content: content)
		} else if let multiRemoteAttachment = obj["multiRemoteAttachment"] as? [String: Any] {
            guard let attachmentsArray = multiRemoteAttachment["attachments"] as? [[String: Any]] else {
                throw Error.badRemoteAttachmentMetadata
            }
            
            let attachments = try attachmentsArray.map { attachment -> MultiRemoteAttachment.RemoteAttachmentInfo in
                guard let metadata = try? EncryptedAttachmentMetadata.fromJsonObj(attachment),
                      let urlString = attachment["url"] as? String else {
                    throw Error.badRemoteAttachmentMetadata
                }
                
                return MultiRemoteAttachment.RemoteAttachmentInfo(
                    url: urlString,
                    filename: metadata.filename,
                    contentLength: UInt32(metadata.contentLength),
                    contentDigest: metadata.contentDigest,
                    nonce: metadata.nonce,
                    scheme: "https",
                    salt: metadata.salt,
                    secret: metadata.secret
                )
            }
            return ContentJson(type: ContentTypeMultiRemoteAttachment, content: MultiRemoteAttachment(remoteAttachments: attachments))
        } else if let readReceipt = obj["readReceipt"] as? [String: Any] {
			return ContentJson(type: ContentTypeReadReceipt, content: ReadReceipt())
		} else {
			throw Error.unknownContentType
		}
	}

	static func fromJson(_ json: String) throws -> ContentJson {
		let data = json.data(using: .utf8)!
		let obj = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
		return try fromJsonObj(obj)
	}

	func toJsonMap() -> [String: Any] {
		switch type.id {
		case ContentTypeText.id:
			return ["text": content]
		case ContentTypeReaction.id where content is XMTP.Reaction:
			let reaction = content as! XMTP.Reaction
			return ["reaction": [
				"reference": reaction.reference,
				"action": reaction.action.rawValue,
				"schema": reaction.schema.rawValue,
				"content": reaction.content,
			]]
        case ContentTypeReactionV2.id:
            guard let encodedContent = encodedContent else {
                return ["error": "Missing encoded content for reaction"]
            }
            do {
                let bytes = try encodedContent.serializedData()
                let reaction = try decodeReaction(bytes: bytes)
                return ["reaction": [
                    "reference": reaction.reference,
                    "action": ReactionV2Action.toString(reaction.action),
                    "schema": ReactionV2Schema.toString(reaction.schema),
                    "content": reaction.content,
                ]]
            } catch {
                return ["error": "Failed to decode reaction: \(error.localizedDescription)"]
            }
		case ContentTypeReply.id where content is XMTP.Reply:
			let reply = content as! XMTP.Reply
			let nested = ContentJson(type: reply.contentType, content: reply.content)
			return ["reply": [
				"reference": reply.reference,
				"content": nested.toJsonMap(),
                "contentType": reply.contentType.description
			] as [String: Any]]
		case ContentTypeAttachment.id where content is XMTP.Attachment:
			let attachment = content as! XMTP.Attachment
			return ["attachment": [
				"filename": attachment.filename,
				"mimeType": attachment.mimeType,
				"data": attachment.data.base64EncodedString(),
			]]
		case ContentTypeRemoteAttachment.id where content is XMTP.RemoteAttachment:
			let remoteAttachment = content as! XMTP.RemoteAttachment
			return ["remoteAttachment": [
				"filename": remoteAttachment.filename ?? "",
				"secret": remoteAttachment.secret.toHex,
				"salt": remoteAttachment.salt.toHex,
				"nonce": remoteAttachment.nonce.toHex,
				"contentDigest": remoteAttachment.contentDigest,
				"contentLength": String(remoteAttachment.contentLength ?? 0),
				"scheme": "https://",
				"url": remoteAttachment.url,
			]]
		case ContentTypeMultiRemoteAttachment.id where content is XMTP.MultiRemoteAttachment:
            guard let encodedContent = encodedContent else {
                return ["error": "Missing encoded content for multi remote attachment"]
            }
            do {
                let bytes = try encodedContent.serializedData()
                let multiRemoteAttachment = try decodeMultiRemoteAttachment(bytes: bytes)
                let attachmentMaps = multiRemoteAttachment.attachments.map { attachment in
                    return [
                        "scheme": "https",
                        "url": attachment.url,
                        "filename": attachment.filename ?? "",
                        "contentLength": String(attachment.contentLength ?? 0),
                        "contentDigest": attachment.contentDigest,
                        "secret": attachment.secret.toHex,
                        "salt": attachment.salt.toHex,
                        "nonce": attachment.nonce.toHex
                    ]
                }
                return ["multiRemoteAttachment": [
                    "attachments": attachmentMaps
                ]]
            } catch {
                return ["error": "Failed to decode multi remote attachment: \(error.localizedDescription)"]
            }
		case ContentTypeReadReceipt.id where content is XMTP.ReadReceipt:
			return ["readReceipt": ""]
		case ContentTypeGroupUpdated.id where content is XMTP.GroupUpdated:
			let groupUpdated = content as! XMTP.GroupUpdated
			return ["groupUpdated": [
				"initiatedByInboxId": groupUpdated.initiatedByInboxID,
				"membersAdded": groupUpdated.addedInboxes.map { member in
					[
						"inboxId": member.inboxID,
					]
				},
				"membersRemoved": groupUpdated.removedInboxes.map { member in
					[
						"inboxId": member.inboxID,
					]
				},
				"metadataFieldsChanged": groupUpdated.metadataFieldChanges.map { metadata in
					[
						"oldValue": metadata.oldValue,
						"newValue": metadata.newValue,
						"fieldName": metadata.fieldName,
					]
				}
			]]
		default:
			if let encodedContent, let encodedContentJSON = try? encodedContent.jsonString() {
				return ["encoded": encodedContentJSON]
			} else {
				return ["unknown": ["contentTypeId": type.description]]
			}
		}
	}
	
}

struct ReactionV2Schema {
    static func fromString(_ schema: String) -> FfiReactionSchema {
        switch schema {
        case "unicode":
            return .unicode
        case "shortcode":
            return .shortcode
        case "custom":
            return .custom
        default:
            return .unknown
        }
    }
    
    static func toString(_ schema: FfiReactionSchema) -> String {
        switch schema {
        case .unicode:
            return "unicode"
        case .shortcode:
            return "shortcode"
        case .custom:
            return "custom"
        case .unknown:
            return "unknown"
        }
    }
}

struct ReactionV2Action {
    static func fromString(_ action: String) -> FfiReactionAction {
        switch action {
        case "removed":
            return .removed
        case "added":
            return .added
        default:
            return .unknown
        }
    }
    
    static func toString(_ action: FfiReactionAction) -> String {
        switch action {
        case .removed:
            return "removed"
        case .added:
            return "added"
        case .unknown:
            return "unknown"
        }
    }
}

struct EncryptedAttachmentMetadata {
	var filename: String
	var secret: Data
	var salt: Data
	var nonce: Data
	var contentDigest: String
	var contentLength: Int

	enum Error: Swift.Error {
		case badRemoteAttachmentMetadata
	}

	static func fromAttachment(attachment: XMTP.Attachment,
	                           encrypted: XMTP.EncryptedEncodedContent) throws -> EncryptedAttachmentMetadata
	{
		return EncryptedAttachmentMetadata(
			filename: attachment.filename,
			secret: encrypted.secret,
			salt: encrypted.salt,
			nonce: encrypted.nonce,
			contentDigest: encrypted.digest,
			contentLength: attachment.data.count
		)
	}

	static func fromJsonObj(_ obj: [String: Any]) throws -> EncryptedAttachmentMetadata {
		let secret = (obj["secret"] as? String ?? "").hexToData
		let salt = (obj["salt"] as? String ?? "").hexToData
		let nonce = (obj["nonce"] as? String ?? "").hexToData
		
		return EncryptedAttachmentMetadata(
			filename: obj["filename"] as? String ?? "",
			secret: secret,
			salt: salt,
			nonce: nonce,
			contentDigest: obj["contentDigest"] as? String ?? "",
			contentLength: Int(obj["contentLength"] as? String ?? "") ?? 0
		)
	}

	func toJsonMap() -> [String: Any] {
		return [ // RemoteAttachmentMetadata
			"filename": filename,
			"secret": secret.toHex,
			"salt": salt.toHex,
			"nonce": nonce.toHex,
			"contentDigest": contentDigest,
			"contentLength": String(contentLength),
		]
	}
}

struct EncryptedLocalAttachment {
	var encryptedLocalFileUri: String
	var metadata: EncryptedAttachmentMetadata

	static func from(attachment: XMTP.Attachment,
	                 encrypted: XMTP.EncryptedEncodedContent,
	                 encryptedFile: URL)
		throws -> EncryptedLocalAttachment
	{
		return try EncryptedLocalAttachment(
			encryptedLocalFileUri: encryptedFile.absoluteString,
			metadata: EncryptedAttachmentMetadata.fromAttachment(
				attachment: attachment,
				encrypted: encrypted
			)
		)
	}

	static func fromJson(_ json: String) throws -> EncryptedLocalAttachment {
		let data = json.data(using: .utf8)!
		let obj = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
		return try EncryptedLocalAttachment(
			encryptedLocalFileUri: obj["encryptedLocalFileUri"] as? String ?? "",
			metadata: EncryptedAttachmentMetadata.fromJsonObj(obj["metadata"] as? [String: Any] ?? [:])
		)
	}

	func toJson() throws -> String {
		let obj: [String: Any] = [
			"encryptedLocalFileUri": encryptedLocalFileUri,
			"metadata": metadata.toJsonMap(),
		]
		return try obj.toJson()
	}
}

struct DecryptedLocalAttachment {
	var fileUri: String
	var mimeType: String
	var filename: String

	static func fromJson(_ json: String) throws -> DecryptedLocalAttachment {
		let data = json.data(using: .utf8)!
		let obj = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
		return DecryptedLocalAttachment(
			fileUri: obj["fileUri"] as? String ?? "",
			mimeType: obj["mimeType"] as? String ?? "",
			filename: obj["filename"] as? String ?? ""
		)
	}

	func toJson() throws -> String {
		let obj: [String: Any] = [
			"fileUri": fileUri,
			"mimeType": mimeType,
			"filename": filename,
		]
		return try obj.toJson()
	}
}

struct PreparedLocalMessage {
	var messageId: String
	var preparedFileUri: String
	var preparedAt: UInt64

	static func fromJson(_ json: String) throws -> PreparedLocalMessage {
		let data = json.data(using: .utf8)!
		let obj = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
		return PreparedLocalMessage(
			messageId: obj["messageId"] as? String ?? "",
			preparedFileUri: obj["preparedFileUri"] as? String ?? "",
			preparedAt: UInt64(truncating: obj["preparedAt"] as? NSNumber ?? 0)
		)
	}

	func toJson() throws -> String {
		let obj: [String: Any] = [
			"messageId": messageId,
			"preparedFileUri": preparedFileUri,
			"preparedAt": preparedAt,
		]
		return try obj.toJson()
	}
}

extension [String: Any] {
	func toJson() throws -> String {
		let data = try JSONSerialization.data(withJSONObject: self)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode json")
		}
		return result
	}
}

extension Data {
	// Cribbed from xmtp-ios
	var toHex: String {
		return reduce("") { $0 + String(format: "%02x", $1) }
	}
}
