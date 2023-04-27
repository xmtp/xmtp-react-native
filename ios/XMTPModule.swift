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

extension Conversation {
	var cacheKey: String {
		if let conversationID, conversationID != "" {
			return "\(topic):\(conversationID)"
		} else {
			return topic
		}
	}
}

public class XMTPModule: Module {
	var apiEnvironments = [
		"local": XMTP.ClientOptions.Api(
			env: XMTP.XMTPEnvironment.local,
			isSecure: false
		),
		"dev": XMTP.ClientOptions.Api(
			env: XMTP.XMTPEnvironment.dev,
			isSecure: true
		),
		"production": XMTP.ClientOptions.Api(
			env: XMTP.XMTPEnvironment.production,
			isSecure: true
		),
	]

	var client: XMTP.Client?
	var signer: ReactNativeSigner?
	var conversations: [String: Conversation] = [:]
	var subscriptions: [String: Task<Void, Never>] = [:]

	enum Error: Swift.Error {
		case noClient, conversationNotFound(String)
	}

	public func definition() -> ModuleDefinition {
    Name("XMTP")

    Events("sign", "authed", "conversation", "message")

		Function("address") { () -> String in
			if let client {
				return client.address
			} else {
				return "No Client."
			}
    	}

		//
		// Auth functions
		//
		AsyncFunction("auth") { (address: String, environment: String) in
				let signer = ReactNativeSigner(module: self, address: address)
				self.signer = signer
				let options = XMTP.ClientOptions(api: apiEnvironments[environment] ?? apiEnvironments["local"]!)
				self.client = try await XMTP.Client.create(account: signer, options: options)
				self.signer = nil
				sendEvent("authed")
		}

		Function("receiveSignature") { (requestID: String, signature: String) in
			try signer?.handle(id: requestID, signature: signature)
		}

		// Generate a random wallet and set the client to that
		AsyncFunction("createRandom") { (environment: String) -> String in
			let privateKey = try PrivateKey.generate()
			let options = XMTP.ClientOptions(api: apiEnvironments[environment] ?? apiEnvironments["local"]!)
			let client = try await Client.create(account: privateKey, options: options)

			self.client = client
			return client.address
		}

		//
		// Client API
		AsyncFunction("listConversations") { () -> [String] in
			guard let client else {
				throw Error.noClient
			}

			let conversations = try await client.conversations.list()

			return try conversations.map { conversation in
				self.conversations[conversation.cacheKey] = conversation

				return try ConversationWrapper.encode(conversation)
			}
		}

		// TODO: Support pagination
		AsyncFunction("loadMessages") { (conversationTopic: String, conversationID: String?) -> [String] in
			guard let client else {
				throw Error.noClient
			}

			guard let conversation = try await findConversation(topic: conversationTopic, conversationID: conversationID) else {
				throw Error.conversationNotFound("no conversation found for \(conversationTopic)")
			}

			return try await conversation.messages(after: Date.init(timeIntervalSince1970: 0)).map { try DecodedMessageWrapper.encode($0) }
		}

		// TODO: Support content types
		AsyncFunction("sendMessage") { (conversationTopic: String, conversationID: String?, content: String) -> String in
			guard let client else {
				throw Error.noClient
			}

			guard let conversation = try await findConversation(topic: conversationTopic, conversationID: conversationID) else {
				throw Error.conversationNotFound("no conversation found for \(conversationTopic)")
			}

			let preparedMessage = try await conversation.prepareMessage(content: content)
			let decodedMessage = try preparedMessage.decodedMessage()

			try await preparedMessage.send()

			return try DecodedMessageWrapper.encode(decodedMessage)
		}

		AsyncFunction("createConversation") { (peerAddress: String, conversationID: String?) -> String in
			guard let client else {
				throw Error.noClient
			}

			let conversation = try await client.conversations.newConversation(with: peerAddress, context: .init(
				conversationID: conversationID ?? "",
				metadata: [:]
			))
			return try ConversationWrapper.encode(conversation)
		}

		Function("subscribeToConversations") {
			subscribeToConversations()
		}

		AsyncFunction("subscribeToMessages") { (topic: String, conversationID: String?) in
			try await subscribeToMessages(topic: topic, conversationID: conversationID)
		}

		AsyncFunction("unsubscribeFromMessages") { (topic: String, conversationID: String?) in
			try await unsubscribeFromMessages(topic: topic, conversationID: conversationID)
		}
  }

	//
	// Helpers
	//

	func findConversation(topic: String, conversationID: String?) async throws -> Conversation? {
		guard let client else {
			throw Error.noClient
		}

		let cacheKey: String

		if let conversationID, conversationID != "" {
			cacheKey = "\(topic):\(conversationID)"
		} else {
			cacheKey = topic
		}

		if let conversation = conversations[cacheKey] {
			return conversation
		} else if let conversation = try await client.conversations.list().first(where: { $0.topic == topic && $0.conversationID == conversationID }) {
			conversations[conversation.cacheKey] = conversation
			return conversation
		}

		return nil
	}

	func subscribeToConversations() {
		guard let client else {
			return
		}

		subscriptions["conversations"] = Task {
			do {
				for try await conversation in client.conversations.stream() {
					sendEvent("conversation", [
						"topic": conversation.topic,
						"peerAddress": conversation.peerAddress,
						"version": conversation.version == .v1 ? "v1" : "v2",
						"conversationID": conversation.conversationID
					])
				}
			} catch {
				print("Error in conversations subscription: \(error)")
				subscriptions["conversations"]?.cancel()
			}
		}
	}

	func subscribeToMessages(topic: String, conversationID: String?) async throws {
		guard let conversation = try await findConversation(topic: topic, conversationID: conversationID) else {
			return
		}

		subscriptions[conversation.cacheKey] = Task {
			do {
				for try await message in conversation.streamMessages() {
					print("GOT A MESSAGE IN SWIFT \(message)")
					sendEvent("message", [
						"topic": conversation.topic,
						"conversationID": conversation.conversationID,
						"messageJSON": try DecodedMessageWrapper.encode(message)
					])
				}
			} catch {
				print("Error in messages subscription: \(error)")
				subscriptions[conversation.cacheKey]?.cancel()
			}
		}
	}

	func unsubscribeFromMessages(topic: String, conversationID: String?) async throws {
		guard let conversation = try await findConversation(topic: topic, conversationID: conversationID) else {
			return
		}

		subscriptions[conversation.cacheKey]?.cancel()
	}
}
