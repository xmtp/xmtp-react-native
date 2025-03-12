import Foundation
import XMTP

class ReactNativeSigner: NSObject, XMTP.SigningKey {
	enum Error: Swift.Error {
		case invalidSignature
	}

	private var module: XMTPModule
	var identity: PublicIdentity
	var type: SignerType
	var chainId: Int64?
	var blockNumber: Int64?
	private var continuations:
		[String: CheckedContinuation<SignedData, Swift.Error>] = [:]

	init(
		module: XMTPModule, publicIdentity: PublicIdentity,
		signerType: SignerType = .EOA, chainId: Int64? = nil,
		blockNumber: Int64? = nil
	) {
		self.module = module
		self.identity = publicIdentity
		self.type = signerType
		self.chainId = chainId
		self.blockNumber = blockNumber
	}

	func handle(id: String, signature: String) {
		guard let continuation = continuations.removeValue(forKey: id) else {
			return
		}

		let signedData: SignedData

		switch self.type {
		case .EOA:
			guard let signatureData = Data(base64Encoded: signature),
				signatureData.count == 65
			else {
				continuation.resume(throwing: Error.invalidSignature)
				return
			}
			signedData = SignedData(
				rawData: signatureData,
				publicKey: identity.identifier.hexToData,
				authenticatorData: nil,
				clientDataJson: nil
			)

		case .SCW:
			signedData = SignedData(
				rawData: signature.hexToData,
				publicKey: identity.identifier.hexToData,
				authenticatorData: nil,
				clientDataJson: nil
			)
		}

		continuation.resume(returning: signedData)
	}

	func sign(_ message: String) async throws -> SignedData {
		let request = SignatureRequest(message: message)
		module.sendEvent(
			"sign", ["id": request.id, "message": request.message])

		return try await withCheckedThrowingContinuation { continuation in
			continuations[request.id] = continuation
		}
	}
}

struct SignatureRequest: Codable {
	var id = UUID().uuidString
	var message: String
}
