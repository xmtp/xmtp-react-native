//
//  PublicIdentityWrapper.swift
//  Pods
//
//  Created by Naomi Plasterer on 3/10/25.
//

import Foundation
import XMTP

enum PublicIdentityError: Swift.Error, LocalizedError {
	case noIdentity

	var errorDescription: String? {
		switch self {
		case .noIdentity:
			return "No identity found."
		}
	}
}
struct PublicIdentityWrapper {
	let identifier: String
	let kind: IdentityKind

	static func publicIdentityFromJson(_ pubIdParams: String) throws -> PublicIdentity {
		guard let data = pubIdParams.data(using: .utf8),
			  let jsonObject = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
			  let kindString = jsonObject["kind"] as? String,
			  let identifier = jsonObject["identifier"] as? String else {
			throw PublicIdentityError.noIdentity
		}
		let kind = {
			switch kindString {
			case "PASSKEY":
				return IdentityKind.passkey
			default:
				return IdentityKind.ethereum
			}
		}()
		return PublicIdentity(kind: kind, identifier: identifier)
	}

	private static func encodeToObj(publicIdentity: PublicIdentity) -> [String: Any] {
		return [
			"identifier": publicIdentity.identifier,
			"kind": publicIdentity.kind
		]
	}

	static func encode(publicIdentity: PublicIdentity) -> String? {
		let obj = encodeToObj(publicIdentity: publicIdentity)
		if let jsonData = try? JSONSerialization.data(withJSONObject: obj, options: []),
		   let jsonString = String(data: jsonData, encoding: .utf8) {
			return jsonString
		}
		return nil
	}
}
