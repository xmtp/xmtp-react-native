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
		switch conversation {
		case .group(let group):
			return try GroupWrapper.encodeToObj(group, client: client)
		default:
			return try ConversationWrapper.encodeToObj(conversation, client: client)
		}
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
