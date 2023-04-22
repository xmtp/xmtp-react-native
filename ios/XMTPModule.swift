import ExpoModulesCore
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
			"message": request.message
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

public class XMTPModule: Module {
	var client: XMTP.Client?
	var signer: ReactNativeSigner?

	enum Error: Swift.Error {
		case noClient
	}

	public func definition() -> ModuleDefinition {
    Name("XMTP")

    Events("sign", "authed")

		Function("address") { () -> String in
			if let client {
				return client.address
			} else {
				return "No Client."
			}
    }

    AsyncFunction("auth") { (address: String) in
			let signer = ReactNativeSigner(module: self, address: address)
			self.signer = signer
			self.client = try await XMTP.Client.create(account: signer)
			self.signer = nil
			sendEvent("authed")
    }

		AsyncFunction("listConversations") { () -> [String] in
			print("LISTING CONVERSATIONS")
			do {
				guard let client else {
					throw Error.noClient
				}

				let conversations = try await client.conversations.list()

				print("GOT CONVERSATIONS \(conversations)")

				return try conversations.map { conversation in
					print("WRAPPING CONVERSATION \(conversation)")
					return try ConversationWrapper.encode(conversation)
				}
			} catch {
				print("ERROR GETTING CONVOS: \(error)")
				return []
			}
		}

		Function("receiveSignature") { (requestID: String, signature: String) in
			try signer?.handle(id: requestID, signature: signature)
		}
  }
}
