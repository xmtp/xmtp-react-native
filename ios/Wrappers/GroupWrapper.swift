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
		let permissionString = switch try group.permissionLevel() {
			case .everyoneIsAdmin:
				"everyone_admin"
			case .groupCreatorIsAdmin:
				"creator_admin"
		}
		return [
			"clientAddress": client.address,
			"id": group.id.toHex,
			"createdAt": UInt64(group.createdAt.timeIntervalSince1970 * 1000),
			"peerAddresses": XMTP.Conversation.group(group).peerAddresses,
			"version": "GROUP",
			"topic": group.id.toHex,
			"permissionLevel": permissionString,
			"adminAddress": try group.adminAddress()
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
