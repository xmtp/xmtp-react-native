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

	init(
		environment: String, dbDirectory: String?,
		historySyncUrl: String?, customLocalUrl: String?,
		deviceSyncEnabled: Bool, debugEventsEnabled: Bool
	) {
		self.environment = environment
		self.dbDirectory = dbDirectory
		self.historySyncUrl = historySyncUrl
		self.customLocalUrl = customLocalUrl
		self.deviceSyncEnabled = deviceSyncEnabled
		self.debugEventsEnabled = debugEventsEnabled
	}

	static func authParamsFromJson(_ authParams: String) -> AuthParamsWrapper {
		guard let data = authParams.data(using: .utf8),
			let jsonOptions = try? JSONSerialization.jsonObject(
				with: data, options: []) as? [String: Any]
		else {
			return AuthParamsWrapper(
				environment: "dev", dbDirectory: nil,
				historySyncUrl: nil, customLocalUrl: nil,
				deviceSyncEnabled: true, debugEventsEnabled: false)
		}

		let environment = jsonOptions["environment"] as? String ?? "dev"
		let dbDirectory = jsonOptions["dbDirectory"] as? String
		let historySyncUrl = jsonOptions["historySyncUrl"] as? String
		let customLocalUrl = jsonOptions["customLocalUrl"] as? String
		let deviceSyncEnabled = jsonOptions["deviceSyncEnabled"] as? Bool ?? true
		let debugEventsEnabled = jsonOptions["debugEventsEnabled"] as? Bool ?? false

		return AuthParamsWrapper(
			environment: environment,
			dbDirectory: dbDirectory,
			historySyncUrl: historySyncUrl,
			customLocalUrl: customLocalUrl,
			deviceSyncEnabled: deviceSyncEnabled,
			debugEventsEnabled: debugEventsEnabled
		)
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
