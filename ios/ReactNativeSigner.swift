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
	var isSmartContractWallet: Bool
	var chainId: UInt64
	var blockNumber: UInt64?
	var continuations: [String: CheckedContinuation<XMTP.Signature, Swift.Error>] = [:]

	init(module: XMTPModule, address: String, isSmartContractWallet: Bool = false, chainId: UInt64 = 1, blockNumber: UInt64? = nil) {
		self.module = module
		self.address = address
		self.isSmartContractWallet = isSmartContractWallet
		self.chainId = chainId
		self.blockNumber = blockNumber
	}

	func handle(id: String, signature: String) throws {
		print("the id")
		print(id)
		guard let continuation = continuations[id] else {
			print("not doing what I want I guess")
			return
		}

		let signature = XMTP.Signature.with {
			$0.ecdsaCompact.bytes = signature.hexToData
		}

		print("resuming with the signature?")
		continuation.resume(returning: signature)
		continuations.removeValue(forKey: id)
	}
	
	func handleSCW(id: String, signature: String) throws {
		guard let continuation = continuations[id] else {
			return
		}

		let signature = XMTP.Signature.with {
			$0.ecdsaCompact.bytes = signature.hexToData
		}
		continuation.resume(returning: signature)
		continuations.removeValue(forKey: id)
	}

	func sign(_ data: Data) async throws -> XMTP.Signature {
		let request = SignatureRequest(message: String(data: data, encoding: .utf8)!)
		print("about to send sign event")
		print(request.message)
		module.sendEvent("signV3", [
			"id": request.id,
			"message": request.message,
		])

		return try await withCheckedThrowingContinuation { continuation in
			print("about to hit continuation")
			print(request.id)
			continuations[request.id] = continuation
		}
	}

	func sign(message: String) async throws -> XMTP.Signature {
		print("HOWDY")
		print(message)
		return try await sign(Data(message.utf8))
	}
}

struct SignatureRequest: Codable {
	var id = UUID().uuidString
	var message: String
}
