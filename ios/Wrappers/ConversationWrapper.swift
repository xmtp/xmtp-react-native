//
//  ConversationWrapper.swift
//
//  Created by Pat Nakajima on 4/21/23.
//

import Foundation
import XMTP

struct ConversationWithClientAddress {
	var clientAddress: String
	var topic: String
	var peerAddress: String
	var version: String
	var conversationID: String?

	init(client: Client, conversation: XMTP.Conversation) {
		clientAddress = client.address
		topic = conversation.topic
		peerAddress = conversation.peerAddress
		version = conversation.version == .v1 ? "v1" : "v2"
		conversationID = conversation.conversationID
	}
}

// Wrapper around XMTP.Conversation to allow passing these objects back
// into react native.
struct ConversationWrapper: Wrapper {
	static func wrap(model: ConversationWithClientAddress) -> ConversationWrapper {
		ConversationWrapper(
			clientAddress: model.clientAddress,
			topic: model.topic,
			peerAddress: model.peerAddress,
			version: model.version,
			conversationID: model.conversationID
		)
	}

	var clientAddress: String
	var topic: String
	var peerAddress: String
	var version: String
	var conversationID: String?
}
