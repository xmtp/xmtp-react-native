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
	static func encodeToObj(_ group: XMTP.Group, client: XMTP.Client) throws -> [String: Any] {
		let permissionPolicySet = try PermissionPolicySetWrapper.encodeToJsonString(group.permissionPolicySet())
		return [
			"clientAddress": client.address,
			"id": group.id.toHex,
			"createdAt": UInt64(group.createdAt.timeIntervalSince1970 * 1000),
			"peerInboxIds": try group.peerInboxIds,
			"version": "GROUP",
			"topic": group.topic,
			"permissionLevel": permissionPolicySet,
			"creatorInboxId": try group.creatorInboxId(),
			"name": try group.groupName(),
			"isActive": try group.isActive(),
			"imageUrlSquare": try group.groupImageUrlSquare(),
		]
	}

	static func encode(_ group: XMTP.Group, client: XMTP.Client) throws -> String {
		let obj = try encodeToObj(group, client: client)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode group")
		}
		return result
	}
}
