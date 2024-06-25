//
//  AuthParamsWrapper.swift
//  XMTPReactNative
//
//  Created by Naomi Plasterer on 6/24/24.
//

import Foundation
import XMTP

class AuthParamsWrapper {
	let environment: String
	let appVersion: String?
	let enableV3: Bool
	let dbDirectory: String?
	let historySyncUrl: String?

	init(environment: String, appVersion: String?, enableV3: Bool, dbDirectory: String?, historySyncUrl: String?) {
		self.environment = environment
		self.appVersion = appVersion
		self.enableV3 = enableV3
		self.dbDirectory = dbDirectory
		self.historySyncUrl = historySyncUrl
	}

	static func authParamsFromJson(_ authParams: String) -> AuthParamsWrapper? {
		guard let data = authParams.data(using: .utf8),
			  let jsonOptions = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
			return nil
		}

		let environment = jsonOptions["environment"] as? String ?? ""
		let appVersion = jsonOptions["appVersion"] as? String
		let enableV3 = jsonOptions["enableV3"] as? Bool ?? false
		let dbDirectory = jsonOptions["dbDirectory"] as? String
		let historySyncUrl = jsonOptions["historySyncUrl"] as? String

		return AuthParamsWrapper(
			environment: environment,
			appVersion: appVersion,
			enableV3: enableV3,
			dbDirectory: dbDirectory,
			historySyncUrl: historySyncUrl
		)
	}
}
