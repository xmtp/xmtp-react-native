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
	let appVersion: String?
	let dbDirectory: String?
	let historySyncUrl: String?

	init(
		environment: String, appVersion: String?, dbDirectory: String?,
		historySyncUrl: String?
	) {
		self.environment = environment
		self.appVersion = appVersion
		self.dbDirectory = dbDirectory
		self.historySyncUrl = historySyncUrl
	}

	static func authParamsFromJson(_ authParams: String) -> AuthParamsWrapper {
		guard let data = authParams.data(using: .utf8),
			let jsonOptions = try? JSONSerialization.jsonObject(
				with: data, options: []) as? [String: Any]
		else {
			return AuthParamsWrapper(
				environment: "dev", appVersion: nil, dbDirectory: nil,
				historySyncUrl: nil)
		}

		let environment = jsonOptions["environment"] as? String ?? "dev"
		let appVersion = jsonOptions["appVersion"] as? String
		let dbDirectory = jsonOptions["dbDirectory"] as? String
		let historySyncUrl = jsonOptions["historySyncUrl"] as? String

		return AuthParamsWrapper(
			environment: environment,
			appVersion: appVersion,
			dbDirectory: dbDirectory,
			historySyncUrl: historySyncUrl
		)
	}
}

struct WalletParamsWrapper {
	let walletType: WalletType
	let chainId: Int64?
	let blockNumber: Int64?

	init(walletType: WalletType, chainId: Int64?, blockNumber: Int64?) {
		self.walletType = walletType
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
				walletType: WalletType.EOA, chainId: nil, blockNumber: nil)
		}

		let walletTypeString = jsonOptions["walletType"] as? String ?? "EOA"
		let chainId = jsonOptions["chainId"] as? Int64
		let blockNumber = jsonOptions["blockNumber"] as? Int64

		let walletType = {
			switch walletTypeString {
			case "SCW":
				return WalletType.SCW
			default:
				return WalletType.EOA
			}
		}()

		return WalletParamsWrapper(
			walletType: walletType,
			chainId: chainId,
			blockNumber: blockNumber
		)
	}
}
