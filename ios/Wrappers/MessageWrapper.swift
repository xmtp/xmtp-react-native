import Foundation
import XMTP

// Wrapper around XMTP.DecodedMessage to allow passing these objects back
// into react native.
struct MessageWrapper {
	static func encodeToObj(_ model: XMTP.DecodedMessage) throws -> [String: Any] {
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

	static func encode(_ model: XMTP.DecodedMessage) throws -> String {
		let obj = try encodeToObj(model)
		return try obj.toJson()
	}

	static func encodeToObjV2(_ model: XMTP.DecodedMessageV2) throws -> [String: Any] {
		let reactionsList = model.reactions ?? []
		let reactions = reactionsList.compactMap { reaction in
			try? encodeToObjV2(reaction)
		}
		let reactionCount = reactionsList.count
		return [
			"id": model.id,
			"conversationId": model.conversationId,
			"contentTypeId": model.contentTypeId.description,
			"nativeContent": ContentJsonV2.toJsonMap(model),
			"senderInboxId": model.senderInboxId,
			"sentAt": model.sentAtNs / 1_000_000,
			"sentAtNs": model.sentAtNs,
			"insertedAtNs": model.insertedAtNs,
			"expiresAtNs": model.expiresAtNs as Any,
			"expiresAt": model.expiresAt.map { Int64($0.timeIntervalSince1970 * 1000) } as Any,
			"fallbackText": (try? model.fallback) as Any,
			"deliveryStatus": model.deliveryStatus.rawValue.uppercased(),
			"reactions": reactions,
			"hasReactions": reactionCount > 0,
			"reactionCount": Int64(reactionCount)
		]
	}

	static func encodeV2(_ model: XMTP.DecodedMessageV2) throws -> String {
		let obj = try encodeToObjV2(model)
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
		LeaveRequestCodec(),
		DeleteMessageCodec(),
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
            return ContentJson(type: ContentTypeReactionV2, content: FfiReactionPayload(
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
        } else if obj["readReceipt"] != nil {
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
		case ContentTypeLeaveRequest.id where content is XMTP.LeaveRequest:
			let leaveRequest = content as! XMTP.LeaveRequest
			let noteString = leaveRequest.authenticatedNote.flatMap { String(data: $0, encoding: .utf8) } ?? ""
			return ["leaveRequest": [
				"authenticatedNote": noteString
			]]
		case ContentTypeDeleteMessageRequest.id where content is XMTP.DeleteMessageRequest:
			let deleteMessage = content as! XMTP.DeleteMessageRequest
			return ["deleteMessage": [
				"messageId": deleteMessage.messageId,
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

// ContentJsonV2 for DecodedMessageV2 content serialization
struct ContentJsonV2 {
	static func toJsonMap(_ message: XMTP.DecodedMessageV2) -> [String: Any] {
		let contentTypeId = message.contentTypeId
		
		switch contentTypeId.id {
		case ContentTypeText.id:
			if let text: String = try? message.content() {
				return ["text": text]
			}
			return ["text": ""]
			
		case ContentTypeReaction.id, ContentTypeReactionV2.id:
			if let reaction: XMTP.Reaction = try? message.content() {
				return ["reaction": [
					"reference": reaction.reference,
					"action": reaction.action.rawValue,
					"schema": reaction.schema.rawValue,
					"content": reaction.content,
				]]
			}
			return ["reaction": [:]]
			
		case ContentTypeReply.id:
			// For DecodedMessageV2, Reply content may be returned as XMTP.Reply
			if let reply: XMTP.Reply = try? message.content() {
				// Reply has: reference, content, contentType
				let nestedContentMap: [String: Any]
				if let textContent = reply.content as? String {
					nestedContentMap = ["text": textContent]
				} else {
					// Content is Any (non-optional), serialize it
					nestedContentMap = ["content": String(describing: reply.content)]
				}
				return ["reply": [
					"reference": reply.reference,
					"content": nestedContentMap
				]]
			}
			return ["reply": [:]]
			
		case ContentTypeAttachment.id:
			if let attachment: XMTP.Attachment = try? message.content() {
				return ["attachment": [
					"filename": attachment.filename,
					"mimeType": attachment.mimeType,
					"data": attachment.data.base64EncodedString(),
				]]
			}
			return ["attachment": [:]]
			
		case ContentTypeRemoteAttachment.id:
			if let remoteAttachment: XMTP.RemoteAttachment = try? message.content() {
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
			}
			return ["remoteAttachment": [:]]
			
		case ContentTypeMultiRemoteAttachment.id:
			if let multiRemoteAttachment: XMTP.MultiRemoteAttachment = try? message.content() {
				let attachmentMaps = multiRemoteAttachment.remoteAttachments.map { attachment in
					return [
						"scheme": "https",
						"url": attachment.url,
						"filename": attachment.filename,
						"contentLength": String(attachment.contentLength),
						"contentDigest": attachment.contentDigest,
						"secret": attachment.secret.toHex,
						"salt": attachment.salt.toHex,
						"nonce": attachment.nonce.toHex
					]
				}
				return ["multiRemoteAttachment": [
					"attachments": attachmentMaps
				]]
			}
			return ["multiRemoteAttachment": ["attachments": []]]
			
		case ContentTypeReadReceipt.id:
			return ["readReceipt": ""]
			
		case ContentTypeGroupUpdated.id:
			if let groupUpdated: XMTP.GroupUpdated = try? message.content() {
				return ["groupUpdated": [
					"initiatedByInboxId": groupUpdated.initiatedByInboxID,
					"membersAdded": groupUpdated.addedInboxes.map { member in
						["inboxId": member.inboxID]
					},
					"membersRemoved": groupUpdated.removedInboxes.map { member in
						["inboxId": member.inboxID]
					},
					"metadataFieldsChanged": groupUpdated.metadataFieldChanges.map { metadata in
						[
							"oldValue": metadata.oldValue,
							"newValue": metadata.newValue,
							"fieldName": metadata.fieldName,
						]
					}
				]]
			}
			return ["groupUpdated": [:]]
			
		case ContentTypeLeaveRequest.id:
			if let leaveRequest: XMTP.LeaveRequest = try? message.content() {
				let noteString = leaveRequest.authenticatedNote.flatMap { String(data: $0, encoding: .utf8) } ?? ""
				return ["leaveRequest": [
					"authenticatedNote": noteString
				]]
			}
			return ["leaveRequest": [:]]
			
		default:
			// For unknown/custom content types, try to serialize the content
			if let content: Any = try? message.content() {
				// Try to convert to JSON-serializable format
				let contentString = String(describing: content)
				return ["unknown": [
					"contentTypeId": contentTypeId.description,
					"content": contentString
				]]
			}
			return ["unknown": [
				"contentTypeId": contentTypeId.description
			]]
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
