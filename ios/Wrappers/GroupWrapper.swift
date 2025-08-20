//
//  GroupWrapper.swift
//  XMTPReactNative
//
//  Created by Naomi Plasterer on 2/9/24.
//

import Foundation
import XMTP

// Wrapper around XMTP.Group to allow passing these objects back into react native.
struct GroupWrapper {
    // The String values in this function should match xmtp-react-native/src/lib/Group.ts: GroupParams
	static func encodeToObj(_ group: XMTP.Group, client: XMTP.Client, conversationParams: ConversationParamsWrapper = ConversationParamsWrapper()) async throws -> [String: Any] {
		var result: [String: Any] = [
			"clientInboxId": client.inboxID,
			"id": group.id,
			"createdAt": UInt64(group.createdAt.timeIntervalSince1970 * 1000),
			"version": "GROUP",
			"topic": group.topic,
			"commitLogForkStatus": ConversationDebugInfoWrapper.commitLogForkStatusToString(group.commitLogForkStatus())
		]

		if conversationParams.isActive {
			result["isActive"] = try group.isActive()
		}
		if conversationParams.addedByInboxId {
			result["addedByInboxId"] = try group.addedByInboxId()
		}
		if conversationParams.name {
			result["name"] = try group.name()
		}
		if conversationParams.imageUrl {
			result["imageUrl"] = try group.imageUrl()
		}
		if conversationParams.description {
			result["description"] = try group.description()
		}
		if conversationParams.consentState {
			result["consentState"] = ConsentWrapper.consentStateToString(state: try group.consentState())
		}
		if conversationParams.lastMessage {
			if let lastMessage = try await group.lastMessage() {
				result["lastMessage"] = try MessageWrapper.encode(lastMessage)
			}
		}
		
		return result
	}

	static func encode(_ group: XMTP.Group, client: XMTP.Client, conversationParams: ConversationParamsWrapper = ConversationParamsWrapper()) async throws -> String {
		let obj = try await encodeToObj(group, client: client, conversationParams: conversationParams)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode group")
		}
		return result
	}
}

struct ConversationParamsWrapper {
	let isActive: Bool
	let addedByInboxId: Bool
	let name: Bool
	let imageUrl: Bool
	let description: Bool
	let consentState: Bool
	let lastMessage: Bool
	
	init(
		isActive: Bool = true,
		addedByInboxId: Bool = true,
		name: Bool = true,
		imageUrl: Bool = true,
		description: Bool = true,
		consentState: Bool = true,
		lastMessage: Bool = false
	) {
		self.isActive = isActive
		self.addedByInboxId = addedByInboxId
		self.name = name
		self.imageUrl = imageUrl
		self.description = description
		self.consentState = consentState
		self.lastMessage = lastMessage
	}
	
	static func conversationParamsFromJson(_ conversationParams: String) -> ConversationParamsWrapper {
		guard let jsonData = conversationParams.data(using: .utf8),
			  let jsonObject = try? JSONSerialization.jsonObject(with: jsonData, options: []),
			  let jsonDict = jsonObject as? [String: Any] else {
			return ConversationParamsWrapper()
		}
		
		return ConversationParamsWrapper(
			isActive: jsonDict["isActive"] as? Bool ?? true,
			addedByInboxId: jsonDict["addedByInboxId"] as? Bool ?? true,
			name: jsonDict["name"] as? Bool ?? true,
			imageUrl: jsonDict["imageUrl"] as? Bool ?? true,
			description: jsonDict["description"] as? Bool ?? true,
			consentState: jsonDict["consentState"] as? Bool ?? true,
			lastMessage: jsonDict["lastMessage"] as? Bool ?? false
		)
	}
}

