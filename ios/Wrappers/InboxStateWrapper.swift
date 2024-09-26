//
//  InboxStateWrapper.swift
//  XMTPReactNative
//
//  Created by Naomi Plasterer on 8/21/24.
//

import Foundation
import XMTP

// Wrapper around XMTP.InboxState to allow passing these objects back into react native.
struct InboxStateWrapper {
	static func encodeToObj(_ inboxState: XMTP.InboxState) throws -> [String: Any] {
		return [
			"inboxId": inboxState.inboxId,
			"addresses": inboxState.addresses,
			"installations": inboxState.installations.map { Installation.encodeInstallation(installation: $0) },
			"recoveryAddress": inboxState.recoveryAddress
		]
	}

	static func encode(_ inboxState: XMTP.InboxState) throws -> String {
		let obj = try encodeToObj(inboxState)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode inboxState")
		}
		return result
	}
}

struct Installation {
	static func encodeInstallation(installation: XMTP.Installation) -> [String: Any] {
		return [
			"id": installation.id,
			"createdAt": installation.createdAt?.timeIntervalSince1970 ?? NSNull()
		]
	}
}
