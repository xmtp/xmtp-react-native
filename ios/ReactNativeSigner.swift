//
//  ReactNativeSigner.swift
//  XMTPReactNative
//
//  Created by Pat Nakajima on 11/14/23.
//

import XMTP

class ReactNativeSigner: NSObject, XMTP.SigningKey {
	enum Error: Swift.Error {
		case invalidSignature
	}

	var module: XMTPModule
	var address: String
	var continuations: [String: CheckedContinuation<XMTP.Signature, Swift.Error>] = [:]

	init(module: XMTPModule, address: String) {
		self.module = module
		self.address = address
	}

	func handle(id: String, signature: String) throws {
		guard let continuation = continuations[id] else {
			return
		}

		guard let signatureData = Data(base64Encoded: Data(signature.utf8)), signatureData.count == 65 else {
			continuation.resume(throwing: Error.invalidSignature)
			continuations.removeValue(forKey: id)
			return
		}

		let signature = XMTP.Signature.with {
			$0.ecdsaCompact.bytes = signatureData[0 ..< 64]
			$0.ecdsaCompact.recovery = UInt32(signatureData[64])
		}

		continuation.resume(returning: signature)
		continuations.removeValue(forKey: id)
	}

	func sign(_ data: Data) async throws -> XMTP.Signature {
		let request = SignatureRequest(message: String(data: data, encoding: .utf8)!)

		module.sendEvent("sign", [
			"id": request.id,
			"message": request.message,
		])

		return try await withCheckedThrowingContinuation { continuation in
			continuations[request.id] = continuation
		}
	}

	func sign(message: String) async throws -> XMTP.Signature {
		return try await sign(Data(message.utf8))
	}
}

struct SignatureRequest: Codable {
	var id = UUID().uuidString
	var message: String
}
