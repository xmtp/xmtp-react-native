import Foundation
import XMTP

// Wrapper around XMTP.Conversation to allow passing these objects back into react native.
struct ConversationWrapper {
	static func encodeToObj(_ conversation: XMTP.Conversation, client: XMTP.Client) async throws -> [String: Any] {
		switch conversation {
		case .group(let group):
			return try await GroupWrapper.encodeToObj(group, client: client)
		case .dm(let dm):
			return try await DmWrapper.encodeToObj(dm, client: client)
		}
	}
	
	static func encode(_ conversation: XMTP.Conversation, client: XMTP.Client) async throws -> String {
		let obj = try await encodeToObj(conversation, client: client)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode conversation")
		}
		return result
	}
}
