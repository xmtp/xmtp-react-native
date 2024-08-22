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
			"installationIds": inboxState.installationIds,
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
