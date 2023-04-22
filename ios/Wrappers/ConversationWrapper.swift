//
//  ConversationWrapper.swift
//
//  Created by Pat Nakajima on 4/21/23.
//

import Foundation
import XMTP

// Wrapper around XMTP.Conversation to allow passing these objects back
// into react native.
struct ConversationWrapper: Wrapper {
	static func wrap(model: XMTP.Conversation) -> ConversationWrapper {
		ConversationWrapper(
			topic: model.topic,
			peerAddress: model.peerAddress,
			version: model.version == .v1 ? "v1" : "v2",
			conversationID: model.conversationID
		)
	}

	var topic: String
	var peerAddress: String
	var version: String
	var conversationID: String?
}
