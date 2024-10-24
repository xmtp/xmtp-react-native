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
	var walletType: WalletType
	var chainId: Int64?
	var blockNumber: Int64?
	var continuations: [String: CheckedContinuation<XMTP.Signature, Swift.Error>] = [:]
	var scwContinuations: [String: CheckedContinuation<Data, Swift.Error>] = [:]

	init(module: XMTPModule, address: String, walletType: WalletType = WalletType.EOA, chainId: Int64? = nil, blockNumber: Int64? = nil) {
		self.module = module
		self.address = address
		self.walletType = walletType
		self.chainId = chainId
		self.blockNumber = blockNumber
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
	
	func handleSCW(id: String, signature: String) throws {
		guard let continuation = scwContinuations[id] else {
			return
		}

		continuation.resume(returning: signature.hexToData)
		scwContinuations.removeValue(forKey: id)
	}
	
	func signSCW(message: String) async throws -> Data {
		let request = SignatureRequest(message: message)

		module.sendEvent("sign", [
			"id": request.id,
			"message": request.message,
		])

		return try await withCheckedThrowingContinuation { continuation in
			scwContinuations[request.id] = continuation
		}
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
