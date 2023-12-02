//
//  ConversationWrapper.swift
//
//  Created by Pat Nakajima on 4/21/23.
//

import Foundation
import XMTP

// Wrapper around XMTP.Conversation to allow passing these objects back into react native.
struct ConversationWrapper {
	static func encodeToObj(_ conversation: XMTP.Conversation, client: XMTP.Client) throws -> [String: Any] {
		var context = [:] as [String: Any]
		if case let .v2(cv2) = conversation {
			context = [
				"conversationID": cv2.context.conversationID,
				"metadata": cv2.context.metadata,
			]
		}
		return [
			"clientAddress": client.address,
			"topic": conversation.topic,
			"createdAt": UInt64(conversation.createdAt.timeIntervalSince1970 * 1000),
			"context": context,
			"peerAddress": conversation.peerAddress,
			"version": conversation.version == .v1 ? "v1" : "v2",
			"conversationID": conversation.conversationID ?? "",
		]
	}

	static func encode(_ conversation: XMTP.Conversation, client: XMTP.Client) throws -> String {
		let obj = try encodeToObj(conversation, client: client)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode conversation")
		}
		return result
	}
}
