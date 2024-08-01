//
//  ClientWrapper.swift
//  XMTPReactNative
//
//  Created by Naomi Plasterer on 6/10/24.
//

import Foundation
import XMTP

// Wrapper around XMTP.Client to allow passing these objects back into react native.
struct ClientWrapper {
	static func encodeToObj(_ client: XMTP.Client) throws -> [String: String] {
		return [
			"inboxId": client.inboxID,
			"address": client.address,
			"installationId": client.installationID,
			"dbPath": client.dbPath,
		]
	}

	static func encode(_ client: XMTP.Client) throws -> String {
		let obj = try encodeToObj(client)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode client")
		}
		return result
	}
}
