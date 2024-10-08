//
//  GroupWrapper.swift
//  XMTPReactNative
//
//  Created by Naomi Plasterer on 2/9/24.
//

import Foundation
import XMTP

enum ConversationOrder {
	case lastMessage, createdAt
}

// Wrapper around XMTP.Group to allow passing these objects back into react native.
struct GroupWrapper {
	static func encodeToObj(_ group: XMTP.Group, client: XMTP.Client, groupParams: GroupParamsWrapper = GroupParamsWrapper()) async throws -> [String: Any] {
		var result: [String: Any] = [
			"clientAddress": client.address,
			"id": group.id,
			"createdAt": UInt64(group.createdAt.timeIntervalSince1970 * 1000),
			"version": "GROUP",
			"topic": group.topic
		]
		
		if groupParams.members {
			result["members"] = try await group.members.compactMap { member in return try MemberWrapper.encode(member) }
		}
		if groupParams.creatorInboxId {
			result["creatorInboxId"] = try group.creatorInboxId()
		}
		if groupParams.isActive {
			result["isActive"] = try group.isActive()
		}
		if groupParams.addedByInboxId {
			result["addedByInboxId"] = try group.addedByInboxId()
		}
		if groupParams.name {
			result["name"] = try group.groupName()
		}
		if groupParams.imageUrlSquare {
			result["imageUrlSquare"] = try group.groupImageUrlSquare()
		}
		if groupParams.description {
			result["description"] = try group.groupDescription()
		}
		if groupParams.consentState {
			result["consentState"] = ConsentWrapper.consentStateToString(state: try group.consentState())
		}
		if groupParams.lastMessage {
			if let lastMessage = try await group.decryptedMessages(limit: 1).first {
				result["lastMessage"] = try DecodedMessageWrapper.encode(lastMessage, client: client)
			}
		}
		
		return result
	}

	static func encode(_ group: XMTP.Group, client: XMTP.Client, groupParams: GroupParamsWrapper = GroupParamsWrapper()) async throws -> String {
		let obj = try await encodeToObj(group, client: client, groupParams: groupParams)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode group")
		}
		return result
	}
}

struct GroupParamsWrapper {
	let members: Bool
	let creatorInboxId: Bool
	let isActive: Bool
	let addedByInboxId: Bool
	let name: Bool
	let imageUrlSquare: Bool
	let description: Bool
	let consentState: Bool
	let lastMessage: Bool
	
	init(
		members: Bool = true,
		creatorInboxId: Bool = true,
		isActive: Bool = true,
		addedByInboxId: Bool = true,
		name: Bool = true,
		imageUrlSquare: Bool = true,
		description: Bool = true,
		consentState: Bool = true,
		lastMessage: Bool = false
	) {
		self.members = members
		self.creatorInboxId = creatorInboxId
		self.isActive = isActive
		self.addedByInboxId = addedByInboxId
		self.name = name
		self.imageUrlSquare = imageUrlSquare
		self.description = description
		self.consentState = consentState
		self.lastMessage = lastMessage
	}
	
	static func groupParamsFromJson(_ groupParams: String) -> GroupParamsWrapper {
		guard let jsonData = groupParams.data(using: .utf8),
			  let jsonObject = try? JSONSerialization.jsonObject(with: jsonData, options: []),
			  let jsonDict = jsonObject as? [String: Any] else {
			return GroupParamsWrapper()
		}
		
		return GroupParamsWrapper(
			members: jsonDict["members"] as? Bool ?? true,
			creatorInboxId: jsonDict["creatorInboxId"] as? Bool ?? true,
			isActive: jsonDict["isActive"] as? Bool ?? true,
			addedByInboxId: jsonDict["addedByInboxId"] as? Bool ?? true,
			name: jsonDict["name"] as? Bool ?? true,
			imageUrlSquare: jsonDict["imageUrlSquare"] as? Bool ?? true,
			description: jsonDict["description"] as? Bool ?? true,
			consentState: jsonDict["consentState"] as? Bool ?? true,
			lastMessage: jsonDict["lastMessage"] as? Bool ?? false
		)
	}
}

