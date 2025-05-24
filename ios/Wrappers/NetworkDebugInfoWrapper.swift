//
//  NetworkDebugInfoWrapper.swift
//  Pods
//
//  Created by Naomi Plasterer on 5/23/25.
//

import Foundation
import XMTP


struct ApiStatsWrapper {
	static func encodeToObj(_ info: ApiStats) -> [String: Any] {
		return [
			"uploadKeyPackage": info.uploadKeyPackage,
			"fetchKeyPackage": info.fetchKeyPackage,
			"sendGroupMessages": info.sendGroupMessages,
			"sendWelcomeMessages": info.sendWelcomeMessages,
			"queryGroupMessages": info.queryGroupMessages,
			"queryWelcomeMessages": info.queryWelcomeMessages,
			"subscribeMessages": info.subscribeMessages,
			"subscribeWelcomes": info.subscribeWelcomes
		]
	}

	static func encode(_ info: ApiStats) throws -> String {
		let obj = encodeToObj(info)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode API stats")
		}
		return result
	}
}


struct IdentityStatsWrapper {
	static func encodeToObj(_ info: IdentityStats) -> [String: Any] {
		return [
			"publishIdentityUpdate": info.publishIdentityUpdate,
			"getIdentityUpdatesV2": info.getIdentityUpdatesV2,
			"getInboxIds": info.getInboxIds,
			"verifySmartContractWalletSignature": info.verifySmartContractWalletSignature
		]
	}

	static func encode(_ info: IdentityStats) throws -> String {
		let obj = encodeToObj(info)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode identity stats")
		}
		return result
	}
}


struct NetworkDebugInfoWrapper {
	static func encodeToObj(_ info: XMTPDebugInformation) -> [String: Any] {
		return [
			"apiStatistics": ApiStatsWrapper.encodeToObj(info.apiStatistics),
			"identityStatistics": IdentityStatsWrapper.encodeToObj(info.identityStatistics),
			"aggregateStatistics": info.aggregateStatistics
		]
	}

	static func encode(_ info: XMTPDebugInformation) throws -> String {
		let obj = encodeToObj(info)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode network debug info")
		}
		return result
	}
}
