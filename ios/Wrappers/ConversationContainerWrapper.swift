//
//  ConversationContainerWrapper.swift
//  XMTPReactNative
//
//  Created by Naomi Plasterer on 2/14/24.
//

import Foundation
import XMTP

// Wrapper around XMTP.ConversationContainer to allow passing these objects back into react native.
struct ConversationContainerWrapper {
	static func encodeToObj(_ conversation: XMTP.Conversation, client: XMTP.Client) throws -> [String: Any] {
		switch conversation.version {
		case .group:
			let group = (conversation as Conversation.group).group
			return GroupWrapper.encodeToObj(group, client: client)
		default:
			return ConversationWrapper.encodeToObj(conversation, client: client)
		}
	}
}
