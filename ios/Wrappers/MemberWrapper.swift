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
		var permissionString = "member"
		switch member.permissionLevel {
			case .Member:
                permissionString = "member"
			case .Admin:
                permissionString = "admin"
			case .SuperAdmin:
				permissionString = "super_admin"
		}
		return [
			"inboxId": member.inboxId,
			"addresses": member.addresses,
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
