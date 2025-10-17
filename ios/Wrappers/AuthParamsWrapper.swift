//
//  AuthParamsWrapper.swift
//  XMTPReactNative
//
//  Created by Naomi Plasterer on 6/24/24.
//

import Foundation
import XMTP

struct AuthParamsWrapper {
	let environment: String
	let dbDirectory: String?
	let historySyncUrl: String?
	let customLocalUrl: String?
	let deviceSyncEnabled: Bool
	let debugEventsEnabled: Bool
	let appVersion: String?
	let gatewayUrl: String?

	init(
		environment: String, dbDirectory: String?,
		historySyncUrl: String?, customLocalUrl: String?,
		deviceSyncEnabled: Bool, debugEventsEnabled: Bool,
		appVersion: String?, gatewayUrl: String?
	) {
		self.environment = environment
		self.dbDirectory = dbDirectory
		self.historySyncUrl = historySyncUrl
		self.customLocalUrl = customLocalUrl
		self.deviceSyncEnabled = deviceSyncEnabled
		self.debugEventsEnabled = debugEventsEnabled
		self.appVersion = appVersion
		self.gatewayUrl = gatewayUrl
	}

	static func authParamsFromJson(_ authParams: String) -> AuthParamsWrapper {
		guard let data = authParams.data(using: .utf8),
			let jsonOptions = try? JSONSerialization.jsonObject(
				with: data, options: []) as? [String: Any]
		else {
			return AuthParamsWrapper(
				environment: "dev", dbDirectory: nil,
				historySyncUrl: nil, customLocalUrl: nil,
				deviceSyncEnabled: true, debugEventsEnabled: false,
				appVersion: nil, gatewayUrl: nil)
		}

		let environment = jsonOptions["environment"] as? String ?? "dev"
		let dbDirectory = Self.stringOrNil(jsonOptions["dbDirectory"] as? String)
		let historySyncUrl = Self.stringOrNil(jsonOptions["historySyncUrl"] as? String)
		let customLocalUrl = Self.stringOrNil(jsonOptions["customLocalUrl"] as? String)
		let deviceSyncEnabled =
			jsonOptions["deviceSyncEnabled"] as? Bool ?? true
		let debugEventsEnabled =
			jsonOptions["debugEventsEnabled"] as? Bool ?? false
		let appVersion = Self.stringOrNil(jsonOptions["appVersion"] as? String)
		let gatewayUrl = Self.stringOrNil(jsonOptions["gatewayUrl"] as? String)

		return AuthParamsWrapper(
			environment: environment,
			dbDirectory: dbDirectory,
			historySyncUrl: historySyncUrl,
			customLocalUrl: customLocalUrl,
			deviceSyncEnabled: deviceSyncEnabled,
			debugEventsEnabled: debugEventsEnabled,
			appVersion: appVersion,
			gatewayUrl: gatewayUrl
		)
	}
	
	// Helper function to convert empty strings to nil
	private static func stringOrNil(_ value: String?) -> String? {
		guard let value = value, !value.isEmpty else { return nil }
		return value
	}
}

struct WalletParamsWrapper {
	let signerType: SignerType
	let chainId: Int64?
	let blockNumber: Int64?

	init(signerType: SignerType, chainId: Int64?, blockNumber: Int64?) {
		self.signerType = signerType
		self.chainId = chainId
		self.blockNumber = blockNumber
	}

	static func walletParamsFromJson(_ walletParams: String)
		-> WalletParamsWrapper
	{
		guard let data = walletParams.data(using: .utf8),
			let jsonOptions = try? JSONSerialization.jsonObject(
				with: data, options: []) as? [String: Any]
		else {
			return WalletParamsWrapper(
				signerType: SignerType.EOA, chainId: nil, blockNumber: nil)
		}

		let walletTypeString = jsonOptions["signerType"] as? String ?? "EOA"
		let chainId = jsonOptions["chainId"] as? Int64
		let blockNumber = jsonOptions["blockNumber"] as? Int64

		let signerType = {
			switch walletTypeString {
			case "SCW":
				return SignerType.SCW
			default:
				return SignerType.EOA
			}
		}()

		return WalletParamsWrapper(
			signerType: signerType,
			chainId: chainId,
			blockNumber: blockNumber
		)
	}
}
