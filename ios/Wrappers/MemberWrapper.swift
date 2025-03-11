//
//  MemberWrapper.swift
//  XMTPReactNative
//
//  Created by Naomi Plasterer on 6/3/24.
//

import Foundation
import XMTP

// Wrapper around XMTP.Member to allow passing these objects back into react native.
struct MemberWrapper {
	static func encodeToObj(_ member: XMTP.Member) throws -> [String: Any] {
		let permissionString = switch member.permissionLevel {
			case .Member:
				"member"
			case .Admin:
				"admin"
			case .SuperAdmin:
				"super_admin"
		}
		return [
			"inboxId": member.inboxId,
			"identities": try member.identities.map {
				try PublicIdentityWrapper.encode(publicIdentity: $0)
			},
			"permissionLevel": permissionString,
			"consentState": ConsentWrapper.consentStateToString(state: member.consentState)
		]
	}

	static func encode(_ member: XMTP.Member) throws -> String {
		let obj = try encodeToObj(member)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode member")
		}
		return result
	}
}

struct MembershipResultWrapper {
	static func encodeToObj(_ result: XMTP.GroupMembershipResult) throws -> [String: Any] {
		return [
			"addedMembers": result.addedMembers,
			"removedMembers": result.removedMembers,
			"failedInstallationIds": result.failedInstallationIds,
		]
	}

	static func encode(_ result: XMTP.GroupMembershipResult) throws -> String {
		let obj = try encodeToObj(result)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let encoded = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode member")
		}
		return encoded
	}
}
