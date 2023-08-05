import Foundation
import XMTP

// Wrapper around XMTP.DecodedMessage to allow passing these objects back
// into react native.
struct DecodedMessageWrapper {
    static func encode(_ model: XMTP.DecodedMessage) throws -> String {
        let obj: [String: Any] = [
            "id": model.id,
            "content": try ContentJson.fromEncoded(model.encodedContent).toJsonMap() as Any,
            "senderAddress": model.senderAddress,
            "sent": UInt64(model.sent.timeIntervalSince1970 * 1000)
        ]
        let data = try JSONSerialization.data(withJSONObject: obj)
        guard let result = String(data: data, encoding: .utf8) else {
            throw WrapperError.encodeError("could not encode \(model)")
        }
        return result
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

    static var codecs: [any ContentCodec] = [
        TextCodec(),
        ReactionCodec(),
        AttachmentCodec(),
        ReplyCodec()
        // TODO:
        //CompositeCodec(),
        //RemoteAttachmentCodec()
    ]

    static func initCodecs() -> Void {
        codecs.forEach { codec in Client.register(codec: codec) }
    }

    enum Error: Swift.Error {
        case unknownContentType, badAttachmentData, badReplyContent
    }

    static func fromEncoded(_ encoded: XMTP.EncodedContent) throws -> ContentJson {
        return ContentJson(type: encoded.type, content: try encoded.decoded())
    }
    
    static func fromJsonObj(_ obj: [String: Any]) throws -> ContentJson {
        if let text = obj["text"] as? String {
            return ContentJson(type: ContentTypeText, content: text)
        } else if let reaction = obj["reaction"] as? [String: Any] {
            return ContentJson(type: ContentTypeReaction, content: Reaction(
                    reference: reaction["reference"] as? String ?? "",
                    action: ReactionAction(rawValue: reaction["action"] as? String ?? "") ?? .added,
                    content: reaction["content"] as? String ?? "",
                    schema: ReactionSchema(rawValue: reaction["schema"] as? String ?? "") ?? .unicode
            ))
        } else if let reply = obj["reply"] as? [String: Any] {
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
                "content": reaction.content
                ]]
        case ContentTypeReply.id where content is XMTP.Reply:
            let reply = content as! XMTP.Reply
            let nested = ContentJson(type: reply.contentType, content: reply.content)
            return ["reply": [
                "reference": reply.reference,
                "content": nested.toJsonMap()
            ] as [String : Any]]
        case ContentTypeAttachment.id where content is XMTP.Attachment:
            let attachment = content as! XMTP.Attachment
            return ["attachment": [
                "filename": attachment.filename,
                "mimeType": attachment.mimeType,
                "data": attachment.data.base64EncodedString()
            ]]
        default:
            return ["unknown": ["contentTypeId": type.id]]
        }
    }
}
