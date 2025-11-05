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
	let gatewayHost: String?
	let forkRecoveryOptions: ForkRecoveryOptions?

	init(
		environment: String, dbDirectory: String?,
		historySyncUrl: String?, customLocalUrl: String?,
		deviceSyncEnabled: Bool, debugEventsEnabled: Bool,
		appVersion: String?, gatewayHost: String?,
		forkRecoveryOptions: ForkRecoveryOptions?
	) {
		self.environment = environment
		self.dbDirectory = dbDirectory
		self.historySyncUrl = historySyncUrl
		self.customLocalUrl = customLocalUrl
		self.deviceSyncEnabled = deviceSyncEnabled
		self.debugEventsEnabled = debugEventsEnabled
		self.appVersion = appVersion
		self.gatewayHost = gatewayHost
		self.forkRecoveryOptions = forkRecoveryOptions
	}

	private static func createForkRecoveryOptions(
		enableRecoveryRequestsString: String?,
		groupsToRequestRecovery: [String]?,
		disableRecoveryResponse: Bool?,
		workerIntervalNs: UInt64?
	) -> ForkRecoveryOptions? {
		// If none of the fork recovery options are provided, return nil
		if enableRecoveryRequestsString == nil && 
		   groupsToRequestRecovery == nil && 
		   disableRecoveryResponse == nil && 
		   workerIntervalNs == nil {
			return nil
		}
		
		return ForkRecoveryOptions(
			enableRecoveryRequests: convertToForkRecoveryPolicy(enableRecoveryRequestsString),
			groupsToRequestRecovery: groupsToRequestRecovery ?? [],
			disableRecoveryResponses: disableRecoveryResponse,
			workerIntervalNs: workerIntervalNs
		)
	}
	
	private static func convertToForkRecoveryPolicy(_ enableRecoveryRequestsString: String?) -> ForkRecoveryPolicy {
		switch enableRecoveryRequestsString {
		case "none":
			return .none
		case "all":
			return .all
		case "groups":
			return .allowlistedGroups
		default:
			return .none
		}
	}

	static func authParamsFromJson(_ authParams: String) -> AuthParamsWrapper {
		guard let data = authParams.data(using: .utf8),
		      let jsonOptions = try? JSONSerialization.jsonObject(
		      	with: data, options: []
		      ) as? [String: Any]
		else {
			return AuthParamsWrapper(
				environment: "dev", dbDirectory: nil,
				historySyncUrl: nil, customLocalUrl: nil,
				deviceSyncEnabled: true, debugEventsEnabled: false,
				appVersion: nil, gatewayHost: nil,
				forkRecoveryOptions: nil
			)
		}

		let environment = jsonOptions["environment"] as? String ?? "dev"
		let dbDirectory = jsonOptions["dbDirectory"] as? String
		let historySyncUrl = jsonOptions["historySyncUrl"] as? String
		if let historySyncUrl = historySyncUrl {
			setenv("XMTP_HISTORY_SERVER_ADDRESS", historySyncUrl, 1)
		}
		let customLocalUrl = jsonOptions["customLocalUrl"] as? String
		if let customLocalUrl = customLocalUrl {
			setenv("XMTP_NODE_ADDRESS", customLocalUrl, 1)
		}
		let deviceSyncEnabled =
			jsonOptions["deviceSyncEnabled"] as? Bool ?? true
		let debugEventsEnabled =
			jsonOptions["debugEventsEnabled"] as? Bool ?? false
		let appVersion = jsonOptions["appVersion"] as? String
		let gatewayHost = jsonOptions["gatewayHost"] as? String
		
		// Parse fork recovery options
		let enableRecoveryRequestsString = jsonOptions["enableRecoveryRequests"] as? String
		let groupsToRequestRecovery = jsonOptions["groupsToRequestRecovery"] as? [String]
		let disableRecoveryResponse = jsonOptions["disableRecoveryResponses"] as? Bool
		let workerIntervalNs = jsonOptions["workerIntervalNs"] as? UInt64
		
		let forkRecoveryOptions = createForkRecoveryOptions(
			enableRecoveryRequestsString: enableRecoveryRequestsString,
			groupsToRequestRecovery: groupsToRequestRecovery,
			disableRecoveryResponse: disableRecoveryResponse,
			workerIntervalNs: workerIntervalNs
		)

		return AuthParamsWrapper(
			environment: environment,
			dbDirectory: dbDirectory,
			historySyncUrl: historySyncUrl,
			customLocalUrl: customLocalUrl,
			deviceSyncEnabled: deviceSyncEnabled,
			debugEventsEnabled: debugEventsEnabled,
			appVersion: appVersion,
			gatewayHost: gatewayHost,
			forkRecoveryOptions: forkRecoveryOptions
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
		      	with: data, options: []
		      ) as? [String: Any]
		else {
			return WalletParamsWrapper(
				signerType: SignerType.EOA, chainId: nil, blockNumber: nil
			)
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
