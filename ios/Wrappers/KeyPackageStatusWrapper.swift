//
//  KeyPackageStatusWrapper.swift
//  Pods
//
//  Created by Naomi Plasterer on 5/30/25.
//

import Foundation
import XMTP
import LibXMTP

struct KeyPackageStatusWrapper {
	static func encodeToObj(keyPackageStatus: FfiKeyPackageStatus) throws -> [String: Any] {
		return [
			"lifetime": try LifetimeWrapper.encode(lifetime: keyPackageStatus.lifetime),
			"validationError": keyPackageStatus.validationError ?? "",
		]
	}

	static func encode(keyPackageStatus: FfiKeyPackageStatus) throws -> String {
		let obj = try encodeToObj(keyPackageStatus: keyPackageStatus)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode key package status")
		}
		return result
	}
}

struct LifetimeWrapper {
	static func encodeToObj(lifetime: FfiLifetime?) throws -> [String: Any] {
		return [
			"notBefore": Int(lifetime?.notBefore ?? 0),
			"notAfter": Int(lifetime?.notAfter ?? 0),
		]
	}

	static func encode(lifetime: FfiLifetime?) throws -> String {
		let obj = try encodeToObj(lifetime: lifetime)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode lifetime")
		}
		return result
	}
}
