import ExpoModulesCore
import LibXMTP
import OSLog
import XMTP

extension Conversation {
	static func cacheKeyForTopic(installationId: String, topic: String)
		-> String
	{
		return "\(installationId):\(topic)"
	}

	func cacheKey(_ installationId: String) -> String {
		return Conversation.cacheKeyForTopic(
			installationId: installationId, topic: topic)
	}
}

actor IsolatedManager<T> {
	private var map: [String: T] = [:]

	func set(_ key: String, _ object: T) {
		map[key] = object
	}

	func get(_ key: String) -> T? {
		map[key]
	}
}

public class XMTPModule: Module {
	var signer: ReactNativeSigner?
	let clientsManager = ClientsManager()
	let subscriptionsManager = IsolatedManager<Task<Void, Never>>()
	private var preAuthenticateToInboxCallbackDeferred: DispatchSemaphore?

	actor ClientsManager {
		private var clients: [String: XMTP.Client] = [:]
		private var signatureRequests: [String: XMTP.SignatureRequest] = [:]

		// A method to update the client
		func updateClient(key: String, client: XMTP.Client) {
			ContentJson.initCodecs()
			clients[key] = client
		}

		// A method to update the signatureRequest
		func updateSignatureRequest(
			key: String, signatureRequest: XMTP.SignatureRequest?
		) {
			signatureRequests[key] = signatureRequest
		}

		// A method to drop client for a given key from memory
		func dropClient(key: String) {
			clients[key] = nil
		}

		// A method to retrieve a client
		func getClient(key: String) -> XMTP.Client? {
			return clients[key]
		}

		// A method to retrieve a signatureRequest
		func getSignatureRequest(key: String) -> XMTP.SignatureRequest? {
			return signatureRequests[key]
		}

		// A method to disconnect all dbs
		func dropAllLocalDatabaseConnections() throws {
			for (_, client) in clients {
				// Call the drop method on each v3 client
				if !client.installationID.isEmpty {
					try client.dropLocalDatabaseConnection()
				}
			}
		}

		// A method to reconnect all dbs
		func reconnectAllLocalDatabaseConnections() async throws {
			for (_, client) in clients {
				// Call the reconnect method on each v3 client
				if !client.installationID.isEmpty {
					try await client.reconnectLocalDatabase()
				}
			}
		}
	}

	enum Error: Swift.Error, LocalizedError {
		case noClient
		case conversationNotFound(String)
		case noMessage
		case invalidPermissionOption
		case noSignatureRequest

		var errorDescription: String? {
			switch self {
			case .noClient:
				return "No client is available."
			case .conversationNotFound(let id):
				return "Conversation with ID '\(id)' was not found."
			case .noMessage:
				return "No message was provided."
			case .invalidPermissionOption:
				return "The permission option is invalid."
			case .noSignatureRequest:
				return "No signature request is available."
			}
		}
	}

	public func definition() -> ModuleDefinition {
		Name("XMTP")

		Events(
			"sign",
			"authed",
			"preAuthenticateToInboxCallback",
			"conversation",
			"message",
			"conversationMessage",
			"consent",
			"preferences"
		)

		AsyncFunction("address") { (installationId: String) -> String in
			if let client = await clientsManager.getClient(key: installationId)
			{
				return client.address
			} else {
				return "No Client."
			}
		}

		AsyncFunction("inboxId") { (installationId: String) -> String in
			if let client = await clientsManager.getClient(key: installationId)
			{
				return client.inboxID
			} else {
				return "No Client."
			}
		}

		AsyncFunction("findInboxIdFromAddress") {
			(installationId: String, address: String) -> String? in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			return try await client.inboxIdFromAddress(address: address)
		}

		AsyncFunction("deleteLocalDatabase") { (installationId: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			try client.deleteLocalDatabase()
		}

		AsyncFunction("dropLocalDatabaseConnection") {
			(installationId: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			try client.dropLocalDatabaseConnection()
		}

		AsyncFunction("reconnectLocalDatabase") { (installationId: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			try await client.reconnectLocalDatabase()
		}

		AsyncFunction("getInboxState") {
			(installationId: String, refreshFromNetwork: Bool) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let inboxState = try await client.inboxState(
				refreshFromNetwork: refreshFromNetwork)
			return try InboxStateWrapper.encode(inboxState)
		}

		AsyncFunction("getInboxStates") {
			(
				installationId: String, refreshFromNetwork: Bool,
				inboxIds: [String]
			)
				-> [String] in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let inboxStates = try await client.inboxStatesForInboxIds(
				refreshFromNetwork: refreshFromNetwork, inboxIds: inboxIds)
			return try inboxStates.map { try InboxStateWrapper.encode($0) }
		}

		Function("preAuthenticateToInboxCallbackCompleted") {
			DispatchQueue.global().async {
				self.preAuthenticateToInboxCallbackDeferred?.signal()
				self.preAuthenticateToInboxCallbackDeferred = nil
			}
		}

		//
		// Auth functions
		//
		Function("receiveSignature") { (requestID: String, signature: String) in
			try signer?.handle(id: requestID, signature: signature)
		}

		Function("receiveSCWSignature") {
			(requestID: String, signature: String) in
			try signer?.handleSCW(id: requestID, signature: signature)
		}

		AsyncFunction("createRandom") {
			(
				hasAuthenticateToInboxCallback: Bool?, dbEncryptionKey: [UInt8],
				authParams: String
			) -> [String: String] in

			let privateKey = try PrivateKey.generate()
			if hasAuthenticateToInboxCallback ?? false {
				preAuthenticateToInboxCallbackDeferred = DispatchSemaphore(
					value: 0)
			}
			let preAuthenticateToInboxCallback: PreEventCallback? =
				hasAuthenticateToInboxCallback ?? false
				? self.preAuthenticateToInboxCallback : nil
			let encryptionKeyData = Data(dbEncryptionKey)

			let options = self.createClientConfig(
				authParams: authParams,
				dbEncryptionKey: encryptionKeyData,
				preAuthenticateToInboxCallback: preAuthenticateToInboxCallback
			)
			let client = try await Client.create(
				account: privateKey, options: options)
			await clientsManager.updateClient(
				key: client.installationID, client: client)
			return try ClientWrapper.encodeToObj(client)
		}

		AsyncFunction("create") {
			(
				address: String, hasAuthenticateToInboxCallback: Bool?,
				dbEncryptionKey: [UInt8], authParams: String,
				walletParams: String
			) in
			let walletOptions = WalletParamsWrapper.walletParamsFromJson(
				walletParams)
			let signer = ReactNativeSigner(
				module: self, address: address,
				walletType: walletOptions.walletType,
				chainId: walletOptions.chainId,
				blockNumber: walletOptions.blockNumber)
			self.signer = signer
			if hasAuthenticateToInboxCallback ?? false {
				self.preAuthenticateToInboxCallbackDeferred = DispatchSemaphore(
					value: 0)
			}
			let preAuthenticateToInboxCallback: PreEventCallback? =
				hasAuthenticateToInboxCallback ?? false
				? self.preAuthenticateToInboxCallback : nil
			let encryptionKeyData = Data(dbEncryptionKey)

			let options = self.createClientConfig(
				authParams: authParams,
				dbEncryptionKey: encryptionKeyData,
				preAuthenticateToInboxCallback: preAuthenticateToInboxCallback
			)
			let client = try await XMTP.Client.create(
				account: signer, options: options)
			await self.clientsManager.updateClient(
				key: client.installationID, client: client)
			self.signer = nil
			self.sendEvent("authed", try ClientWrapper.encodeToObj(client))
		}

		AsyncFunction("build") {
			(
				address: String, inboxId: String?, dbEncryptionKey: [UInt8],
				authParams: String
			)
				-> [String: String] in
			let authOptions = AuthParamsWrapper.authParamsFromJson(authParams)
			let encryptionKeyData = Data(dbEncryptionKey)

			let options = self.createClientConfig(
				authParams: authParams,
				dbEncryptionKey: encryptionKeyData,
				preAuthenticateToInboxCallback: preAuthenticateToInboxCallback
			)
			let client = try await XMTP.Client.build(
				address: address, options: options, inboxId: inboxId)
			await clientsManager.updateClient(
				key: client.installationID, client: client)
			return try ClientWrapper.encodeToObj(client)
		}

		AsyncFunction("ffiCreateClient") {
			(
				address: String, dbEncryptionKey: [UInt8],
				authParams: String
			)
				-> [String: String] in
			let authOptions = AuthParamsWrapper.authParamsFromJson(authParams)
			let encryptionKeyData = Data(dbEncryptionKey)

			let options = self.createClientConfig(
				authParams: authParams,
				dbEncryptionKey: encryptionKeyData
			)
			let client = try await XMTP.Client.ffiCreateClient(
				address: address, clientOptions: options)
			await clientsManager.updateClient(
				key: client.installationID, client: client)
			return try ClientWrapper.encodeToObj(client)
		}

		AsyncFunction("ffiCreateSignatureText") {
			(installationId: String) -> String? in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let sigRequest = client.ffiSignatureRequest()
			await clientsManager.updateSignatureRequest(
				key: client.installationID, signatureRequest: sigRequest)
			return try await sigRequest?.signatureText()
		}

		AsyncFunction("ffiAddEcdsaSignature") {
			(installationId: String, signatureBytes: [UInt8]) in
			try await clientsManager.getSignatureRequest(
				key: installationId)?.addEcdsaSignature(
					signatureBytes: Data(signatureBytes))
		}

		AsyncFunction("ffiAddScwSignature") {
			(
				installationId: String, signatureBytes: [UInt8],
				address: String, chainId: Int64, blockNumber: Int64?
			) in
			try await clientsManager.getSignatureRequest(
				key: installationId)?.addScwSignature(
					signatureBytes: Data(signatureBytes), address: address,
					chainId: UInt64(chainId),
					blockNumber: blockNumber.flatMap {
						$0 >= 0 ? UInt64($0) : nil
					})
		}

		AsyncFunction("ffiRegisterIdentity") {
			(installationId: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let sigRequest = await clientsManager.getSignatureRequest(
					key: installationId)
			else {
				throw Error.noSignatureRequest
			}
			try await client.ffiRegisterIdentity(signatureRequest: sigRequest)
		}

		AsyncFunction("revokeInstallations") {
			(
				installationId: String, walletParams: String,
				installationIds: [String]
			) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let walletOptions = WalletParamsWrapper.walletParamsFromJson(
				walletParams)
			let signer = ReactNativeSigner(
				module: self, address: client.address,
				walletType: walletOptions.walletType,
				chainId: walletOptions.chainId,
				blockNumber: walletOptions.blockNumber)
			self.signer = signer

			try await client.revokeInstallations(
				signingKey: signer, installationIds: installationIds)
			self.signer = nil
		}

		AsyncFunction("revokeAllOtherInstallations") {
			(installationId: String, walletParams: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let walletOptions = WalletParamsWrapper.walletParamsFromJson(
				walletParams)
			let signer = ReactNativeSigner(
				module: self, address: client.address,
				walletType: walletOptions.walletType,
				chainId: walletOptions.chainId,
				blockNumber: walletOptions.blockNumber)
			self.signer = signer

			try await client.revokeAllOtherInstallations(signingKey: signer)
			self.signer = nil
		}

		AsyncFunction("addAccount") {
			(
				installationId: String, newAddress: String,
				walletParams: String, allowReassignInboxId: Bool
			)
			in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let walletOptions = WalletParamsWrapper.walletParamsFromJson(
				walletParams)
			let signer = ReactNativeSigner(
				module: self, address: newAddress,
				walletType: walletOptions.walletType,
				chainId: walletOptions.chainId,
				blockNumber: walletOptions.blockNumber)
			self.signer = signer

			try await client.addAccount(
				newAccount: signer, allowReassignInboxId: allowReassignInboxId)
			self.signer = nil
		}

		AsyncFunction("removeAccount") {
			(
				installationId: String, addressToRemove: String,
				walletParams: String
			) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let walletOptions = WalletParamsWrapper.walletParamsFromJson(
				walletParams)
			let signer = ReactNativeSigner(
				module: self, address: client.address,
				walletType: walletOptions.walletType,
				chainId: walletOptions.chainId,
				blockNumber: walletOptions.blockNumber)
			self.signer = signer

			try await client.removeAccount(
				recoveryAccount: signer, addressToRemove: addressToRemove)
			self.signer = nil
		}

		AsyncFunction("ffiRevokeInstallationsSignatureText") {
			(installationId: String, installationIds: [String]) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let ids = installationIds.map { $0.hexToData }
			let sigRequest = try await client.ffiRevokeInstallations(ids: ids)
			await clientsManager.updateSignatureRequest(
				key: client.installationID, signatureRequest: sigRequest)
			return try await sigRequest.signatureText()
		}

		AsyncFunction("ffiRevokeAllOtherInstallationsSignatureText") {
			(installationId: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let sigRequest = try await client.ffiRevokeAllOtherInstallations()
			await clientsManager.updateSignatureRequest(
				key: client.installationID, signatureRequest: sigRequest)
			return try await sigRequest.signatureText()
		}

		AsyncFunction("ffiRevokeWalletSignatureText") {
			(installationId: String, addressToRemove: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let sigRequest = try await client.ffiRevokeWallet(
				addressToRemove: addressToRemove)
			await clientsManager.updateSignatureRequest(
				key: client.installationID, signatureRequest: sigRequest)
			return try await sigRequest.signatureText()
		}

		AsyncFunction("ffiAddWalletSignatureText") {
			(installationId: String, addressToAdd: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let sigRequest = try await client.ffiAddWallet(
				addressToAdd: addressToAdd)
			await clientsManager.updateSignatureRequest(
				key: client.installationID, signatureRequest: sigRequest)
			return try await sigRequest.signatureText()
		}

		AsyncFunction("ffiApplySignatureRequest") {
			(installationId: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let sigRequest = await clientsManager.getSignatureRequest(
					key: installationId)
			else {
				throw Error.noSignatureRequest
			}
			try await client.ffiApplySignatureRequest(
				signatureRequest: sigRequest)
		}

		// Remove a client from memory for a given inboxId
		AsyncFunction("dropClient") { (installationId: String) in
			await clientsManager.dropClient(key: installationId)
		}

		AsyncFunction("signWithInstallationKey") {
			(installationId: String, message: String) -> [UInt8] in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let signature = try client.signWithInstallationKey(message: message)
			return [UInt8](signature)
		}

		AsyncFunction("verifySignature") {
			(installationId: String, message: String, signature: [UInt8])
				-> Bool in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			return try client.verifySignature(
				message: message, signature: Data(signature))
		}

		AsyncFunction("canMessage") {
			(installationId: String, peerAddresses: [String]) -> [String: Bool]
			in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}

			return try await client.canMessage(addresses: peerAddresses)
		}

		AsyncFunction("staticCanMessage") {
			(environment: String, peerAddresses: [String]) -> [String: Bool] in
			return try await XMTP.Client.canMessage(
				accountAddresses: peerAddresses,
				api: createApiClient(env: environment)
			)
		}

		AsyncFunction("staticInboxStatesForInboxIds") {
			(environment: String, inboxIds: [String]) -> [String] in
			let inboxStates = try await XMTP.Client.inboxStatesForInboxIds(
				inboxIds: inboxIds, api: createApiClient(env: environment))
			return try inboxStates.map { try InboxStateWrapper.encode($0) }
		}

		AsyncFunction("getOrCreateInboxId") {
			(address: String, environment: String) -> String in
			do {
				let api = createApiClient(env: environment)
				return try await XMTP.Client.getOrCreateInboxId(
					api: api, address: address)
			} catch {
				throw Error.noClient
			}
		}

		AsyncFunction("encryptAttachment") {
			(installationId: String, fileJson: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let file = try DecryptedLocalAttachment.fromJson(fileJson)
			let url = URL(string: file.fileUri)
			let data = try Data(contentsOf: url!)
			let attachment = Attachment(
				filename: url!.lastPathComponent,
				mimeType: file.mimeType,
				data: data
			)
			let encrypted = try RemoteAttachment.encodeEncrypted(
				content: attachment,
				codec: AttachmentCodec()
			)
			let encryptedFile = FileManager.default.temporaryDirectory
				.appendingPathComponent(UUID().uuidString)
			try encrypted.payload.write(to: encryptedFile)

			return try EncryptedLocalAttachment.from(
				attachment: attachment,
				encrypted: encrypted,
				encryptedFile: encryptedFile
			).toJson()
		}

		AsyncFunction("decryptAttachment") {
			(installationId: String, encryptedFileJson: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let encryptedFile = try EncryptedLocalAttachment.fromJson(
				encryptedFileJson)
			let encryptedData = try Data(
				contentsOf: URL(string: encryptedFile.encryptedLocalFileUri)!)

			let encrypted = EncryptedEncodedContent(
				secret: encryptedFile.metadata.secret,
				digest: encryptedFile.metadata.contentDigest,
				salt: encryptedFile.metadata.salt,
				nonce: encryptedFile.metadata.nonce,
				payload: encryptedData
			)
			let encoded = try RemoteAttachment.decryptEncoded(
				encrypted: encrypted)
			let attachment: Attachment = try encoded.decoded()
			let file = FileManager.default.temporaryDirectory
				.appendingPathComponent(UUID().uuidString)
			try attachment.data.write(to: file)
			return try DecryptedLocalAttachment(
				fileUri: file.absoluteString,
				mimeType: attachment.mimeType,
				filename: attachment.filename
			).toJson()
		}

		AsyncFunction("listGroups") {
			(
				installationId: String, groupParams: String?,
				limit: Int?, consentStringStates: [String]?
			) -> [String] in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}

			let params = ConversationParamsWrapper.conversationParamsFromJson(
				groupParams ?? "")
			let consentStates: [ConsentState]?
			if let states = consentStringStates {
				consentStates = try getConsentStates(states: states)
			} else {
				consentStates = nil
			}
			var groupList: [Group] = try await client.conversations.listGroups(
				limit: limit, consentStates: consentStates)

			var results: [String] = []
			for group in groupList {
				let encodedGroup = try await GroupWrapper.encode(
					group, client: client, conversationParams: params)
				results.append(encodedGroup)
			}
			return results
		}

		AsyncFunction("listDms") {
			(
				installationId: String, groupParams: String?,
				limit: Int?, consentStringStates: [String]?
			) -> [String] in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}

			let params = ConversationParamsWrapper.conversationParamsFromJson(
				groupParams ?? "")
			let consentStates: [ConsentState]?
			if let states = consentStringStates {
				consentStates = try getConsentStates(states: states)
			} else {
				consentStates = nil
			}
			var dmList: [Dm] = try await client.conversations.listDms(
				limit: limit, consentStates: consentStates)

			var results: [String] = []
			for dm in dmList {
				let encodedDm = try await DmWrapper.encode(
					dm, client: client, conversationParams: params)
				results.append(encodedDm)
			}
			return results
		}

		AsyncFunction("listConversations") {
			(
				installationId: String, conversationParams: String?,
				limit: Int?, consentStringStates: [String]?
			) -> [String] in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}

			let params = ConversationParamsWrapper.conversationParamsFromJson(
				conversationParams ?? "")
			let consentStates: [ConsentState]?
			if let states = consentStringStates {
				consentStates = try getConsentStates(states: states)
			} else {
				consentStates = nil
			}
			let conversations = try await client.conversations.list(
				limit: limit, consentStates: consentStates)

			var results: [String] = []
			for conversation in conversations {
				let encodedConversationContainer =
					try await ConversationWrapper.encode(
						conversation, client: client, conversationParams: params
					)
				results.append(encodedConversationContainer)
			}
			return results
		}

		AsyncFunction("getHmacKeys") { (installationId: String) -> [UInt8] in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let hmacKeys = try await client.conversations.getHmacKeys()

			return try [UInt8](hmacKeys.serializedData())
		}

		AsyncFunction("conversationMessages") {
			(
				installationId: String, conversationId: String, limit: Int?,
				beforeNs: Double?, afterNs: Double?, direction: String?
			) -> [String] in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}

			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(conversationId)")
			}
			let messages = try await conversation.messages(
				limit: limit,
				beforeNs: (beforeNs != nil) ? Int64(beforeNs!) : nil,
				afterNs: (afterNs != nil) ? Int64(afterNs!) : nil,
				direction: getSortDirection(
					direction: direction ?? "DESCENDING")
			)

			return messages.compactMap { msg in
				do {
					return try MessageWrapper.encode(msg)
				} catch {
					print(
						"discarding message, unable to encode wrapper \(msg.id)"
					)
					return nil
				}
			}
		}

		AsyncFunction("conversationMessagesWithReactions") {
			(
				installationId: String, conversationId: String, limit: Int?,
				beforeNs: Double?, afterNs: Double?, direction: String?
			) -> [String] in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(conversationId)")
			}
			let messages = try await conversation.messagesWithReactions(
				limit: limit,
				beforeNs: beforeNs != nil ? Int64(beforeNs!) : nil,
				afterNs: afterNs != nil ? Int64(afterNs!) : nil,
				direction: getSortDirection(
					direction: direction ?? "DESCENDING")
			)
			return messages.compactMap { msg in
				do {
					return try MessageWrapper.encode(msg)
				} catch {
					print(
						"discarding message, unable to encode wrapper \(msg.id)"
					)
					return nil
				}
			}
		}

		AsyncFunction("findMessage") {
			(installationId: String, messageId: String) -> String? in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			if let message = try await client.conversations.findMessage(
				messageId: messageId)
			{
				return try MessageWrapper.encode(
					message)
			} else {
				return nil
			}
		}

		AsyncFunction("findGroup") {
			(installationId: String, groupId: String) -> String? in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			if let group = try await client.conversations.findGroup(
				groupId: groupId)
			{
				return try await GroupWrapper.encode(group, client: client)
			} else {
				return nil
			}
		}

		AsyncFunction("findConversation") {
			(installationId: String, conversationId: String) -> String? in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}

			if let conversation = try await client.conversations
				.findConversation(
					conversationId: conversationId)
			{
				return try await ConversationWrapper.encode(
					conversation, client: client)
			} else {
				return nil
			}
		}

		AsyncFunction("findConversationByTopic") {
			(installationId: String, topic: String) -> String? in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			if let conversation = try await client.conversations
				.findConversationByTopic(
					topic: topic)
			{
				return try await ConversationWrapper.encode(
					conversation, client: client)
			} else {
				return nil
			}
		}

		AsyncFunction("findDmByInboxId") {
			(installationId: String, peerInboxId: String) -> String? in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			if let dm = try await client.conversations.findDmByInboxId(
				inboxId: peerInboxId)
			{
				return try await DmWrapper.encode(dm, client: client)
			} else {
				return nil
			}
		}

		AsyncFunction("findDmByAddress") {
			(installationId: String, peerAddress: String) -> String? in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			if let dm = try await client.conversations.findDmByAddress(
				address: peerAddress)
			{
				return try await DmWrapper.encode(dm, client: client)
			} else {
				return nil
			}
		}

		AsyncFunction("sendEncodedContent") {
			(
				installationId: String, conversationId: String,
				encodedContentData: [UInt8]
			) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(conversationId)")
			}
			let encodedContent = try EncodedContent(
				serializedBytes: Data(encodedContentData))

			return try await conversation.send(encodedContent: encodedContent)
		}

		AsyncFunction("sendMessage") {
			(installationId: String, id: String, contentJson: String) -> String
			in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			let sending = try ContentJson.fromJson(contentJson)
			return try await conversation.send(
				content: sending.content,
				options: SendOptions(contentType: sending.type)
			)
		}

		AsyncFunction("publishPreparedMessages") {
			(installationId: String, id: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			try await conversation.publishMessages()
		}

		AsyncFunction("prepareMessage") {
			(installationId: String, id: String, contentJson: String) -> String
			in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			let sending = try ContentJson.fromJson(contentJson)
			return try await conversation.prepareMessage(
				content: sending.content,
				options: SendOptions(contentType: sending.type)
			)
		}

		AsyncFunction("prepareEncodedMessage") {
			(
				installationId: String,
				conversationId: String,
				encodedContentData: [UInt8]
			) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(conversationId)")
			}
			let encodedContent = try EncodedContent(
				serializedBytes: Data(encodedContentData))
			return try await conversation.prepareMessage(
				encodedContent: encodedContent)
		}

		AsyncFunction("findOrCreateDm") {
			(
				installationId: String, peerAddress: String,
				disappearStartingAtNs: Int64?, retentionDurationInNs: Int64?
			) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let settings =
				(disappearStartingAtNs != nil && retentionDurationInNs != nil)
				? DisappearingMessageSettings(
					disappearStartingAtNs: disappearStartingAtNs!,
					retentionDurationInNs: retentionDurationInNs!) : nil

			do {
				let dm = try await client.conversations.findOrCreateDm(
					with: peerAddress, disappearingMessageSettings: settings)
				return try await DmWrapper.encode(dm, client: client)
			} catch {
				print("ERRRO!: \(error.localizedDescription)")
				throw error
			}
		}

		AsyncFunction("findOrCreateDmWithInboxId") {
			(
				installationId: String, peerInboxId: String,
				disappearStartingAtNs: Int64?, retentionDurationInNs: Int64?
			) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let settings =
				(disappearStartingAtNs != nil && retentionDurationInNs != nil)
				? DisappearingMessageSettings(
					disappearStartingAtNs: disappearStartingAtNs!,
					retentionDurationInNs: retentionDurationInNs!) : nil

			do {
				let dm = try await client.conversations
					.findOrCreateDmWithInboxId(
						with: peerInboxId, disappearingMessageSettings: settings
					)
				return try await DmWrapper.encode(dm, client: client)
			} catch {
				print("ERRRO!: \(error.localizedDescription)")
				throw error
			}
		}

		AsyncFunction("createGroup") {
			(
				installationId: String, peerAddresses: [String],
				permission: String,
				groupOptionsJson: String
			) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let permissionLevel: GroupPermissionPreconfiguration = {
				switch permission {
				case "admin_only":
					return .adminOnly
				default:
					return .allMembers
				}
			}()
			do {
				let createGroupParams =
					CreateGroupParamsWrapper.createGroupParamsFromJson(
						groupOptionsJson)
				let group = try await client.conversations.newGroup(
					with: peerAddresses,
					permissions: permissionLevel,
					name: createGroupParams.groupName,
					imageUrlSquare: createGroupParams.groupImageUrlSquare,
					description: createGroupParams.groupDescription,
					disappearingMessageSettings: createGroupParams
						.disappearingMessageSettings
				)
				return try await GroupWrapper.encode(group, client: client)
			} catch {
				print("ERRRO!: \(error.localizedDescription)")
				throw error
			}
		}

		AsyncFunction("createGroupCustomPermissions") {
			(
				installationId: String, peerAddresses: [String],
				permissionPolicySetJson: String, groupOptionsJson: String
			) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			do {
				let createGroupParams =
					CreateGroupParamsWrapper.createGroupParamsFromJson(
						groupOptionsJson)
				let permissionPolicySet =
					try PermissionPolicySetWrapper.createPermissionPolicySet(
						from: permissionPolicySetJson)
				let group = try await client.conversations
					.newGroupCustomPermissions(
						with: peerAddresses,
						permissionPolicySet: permissionPolicySet,
						name: createGroupParams.groupName,
						imageUrlSquare: createGroupParams.groupImageUrlSquare,
						description: createGroupParams.groupDescription,
						disappearingMessageSettings: createGroupParams
							.disappearingMessageSettings
					)
				return try await GroupWrapper.encode(group, client: client)
			} catch {
				print("ERRRO!: \(error.localizedDescription)")
				throw error
			}
		}

		AsyncFunction("createGroupWithInboxIds") {
			(
				installationId: String, inboxIds: [String],
				permission: String,
				groupOptionsJson: String
			) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let permissionLevel: GroupPermissionPreconfiguration = {
				switch permission {
				case "admin_only":
					return .adminOnly
				default:
					return .allMembers
				}
			}()
			do {
				let createGroupParams =
					CreateGroupParamsWrapper.createGroupParamsFromJson(
						groupOptionsJson)
				let group = try await client.conversations.newGroupWithInboxIds(
					with: inboxIds,
					permissions: permissionLevel,
					name: createGroupParams.groupName,
					imageUrlSquare: createGroupParams.groupImageUrlSquare,
					description: createGroupParams.groupDescription,
					disappearingMessageSettings: createGroupParams
						.disappearingMessageSettings
				)
				return try await GroupWrapper.encode(group, client: client)
			} catch {
				print("ERRRO!: \(error.localizedDescription)")
				throw error
			}
		}

		AsyncFunction("createGroupCustomPermissionsWithInboxIds") {
			(
				installationId: String, inboxIds: [String],
				permissionPolicySetJson: String, groupOptionsJson: String
			) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			do {
				let createGroupParams =
					CreateGroupParamsWrapper.createGroupParamsFromJson(
						groupOptionsJson)
				let permissionPolicySet =
					try PermissionPolicySetWrapper.createPermissionPolicySet(
						from: permissionPolicySetJson)
				let group = try await client.conversations
					.newGroupCustomPermissionsWithInboxIds(
						with: inboxIds,
						permissionPolicySet: permissionPolicySet,
						name: createGroupParams.groupName,
						imageUrlSquare: createGroupParams.groupImageUrlSquare,
						description: createGroupParams.groupDescription,
						disappearingMessageSettings: createGroupParams
							.disappearingMessageSettings
					)
				return try await GroupWrapper.encode(group, client: client)
			} catch {
				print("ERRRO!: \(error.localizedDescription)")
				throw error
			}
		}

		AsyncFunction("listMemberInboxIds") {
			(installationId: String, groupId: String) -> [String] in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: groupId)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(groupId)")
			}
			return try await group.members.map(\.inboxId)
		}

		AsyncFunction("dmPeerInboxId") {
			(installationId: String, dmId: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: dmId)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(dmId)")
			}
			if case let .dm(dm) = conversation {
				return try dm.peerInboxId
			} else {
				throw Error.conversationNotFound(
					"no conversation found for \(dmId)")

			}
		}

		AsyncFunction("listConversationMembers") {
			(installationId: String, conversationId: String) -> [String] in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}

			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(conversationId)")
			}
			return try await conversation.members().compactMap { member in
				return try MemberWrapper.encode(member)
			}
		}

		AsyncFunction("syncConversations") { (installationId: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			try await client.conversations.sync()
		}

		AsyncFunction("syncAllConversations") {
			(installationId: String, consentStringStates: [String]?) -> UInt32
			in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			let consentStates: [ConsentState]?
			if let states = consentStringStates {
				consentStates = try getConsentStates(states: states)
			} else {
				consentStates = nil
			}
			return try await client.conversations.syncAllConversations(
				consentStates: consentStates)
		}

		AsyncFunction("syncConversation") {
			(installationId: String, id: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await conversation.sync()
		}

		AsyncFunction("addGroupMembers") {
			(installationId: String, id: String, peerAddresses: [String]) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.addMembers(addresses: peerAddresses)
		}

		AsyncFunction("removeGroupMembers") {
			(installationId: String, id: String, peerAddresses: [String]) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.removeMembers(addresses: peerAddresses)
		}

		AsyncFunction("addGroupMembersByInboxId") {
			(installationId: String, id: String, inboxIds: [String]) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.addMembersByInboxId(inboxIds: inboxIds)
		}

		AsyncFunction("removeGroupMembersByInboxId") {
			(installationId: String, id: String, inboxIds: [String]) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			try await group.removeMembersByInboxId(inboxIds: inboxIds)
		}

		AsyncFunction("groupName") {
			(installationId: String, id: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			return try group.groupName()
		}

		AsyncFunction("updateGroupName") {
			(installationId: String, id: String, groupName: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			try await group.updateGroupName(groupName: groupName)
		}

		AsyncFunction("groupImageUrlSquare") {
			(installationId: String, id: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			return try group.groupImageUrlSquare()
		}

		AsyncFunction("updateGroupImageUrlSquare") {
			(installationId: String, id: String, groupImageUrl: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			try await group.updateGroupImageUrlSquare(
				imageUrlSquare: groupImageUrl)
		}

		AsyncFunction("groupDescription") {
			(installationId: String, id: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			return try group.groupDescription()
		}

		AsyncFunction("updateGroupDescription") {
			(installationId: String, id: String, description: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			try await group.updateGroupDescription(
				groupDescription: description)
		}

		AsyncFunction("disappearingMessageSettings") {
			(installationId: String, conversationId: String) -> String? in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"No conversation found for \(conversationId)")
			}
			return try conversation.disappearingMessageSettings.map {
				try DisappearingMessageSettingsWrapper.encode($0)
			}
		}

		AsyncFunction("isDisappearingMessagesEnabled") {
			(installationId: String, conversationId: String) -> Bool in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"No conversation found for \(conversationId)")
			}
			return try conversation.isDisappearingMessagesEnabled()
		}

		AsyncFunction("clearDisappearingMessageSettings") {
			(installationId: String, conversationId: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"No conversation found for \(conversationId)")
			}
			try await conversation.clearDisappearingMessageSettings()
		}

		AsyncFunction("updateDisappearingMessageSettings") {
			(
				installationId: String, conversationId: String,
				startAtNs: Int64, durationInNs: Int64
			) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"No conversation found for \(conversationId)")
			}
			try await conversation.updateDisappearingMessageSettings(
				DisappearingMessageSettings(
					disappearStartingAtNs: startAtNs,
					retentionDurationInNs: durationInNs)
			)
		}

		AsyncFunction("isGroupActive") {
			(installationId: String, id: String) -> Bool in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			return try group.isActive()
		}

		AsyncFunction("addedByInboxId") {
			(installationId: String, id: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			return try group.addedByInboxId()
		}

		AsyncFunction("creatorInboxId") {
			(installationId: String, id: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			return try await group.creatorInboxId()
		}

		AsyncFunction("isAdmin") {
			(clientInstallationId: String, id: String, inboxId: String) -> Bool
			in
			guard
				let client = await clientsManager.getClient(
					key: clientInstallationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			return try group.isAdmin(inboxId: inboxId)
		}

		AsyncFunction("isSuperAdmin") {
			(clientInstallationId: String, id: String, inboxId: String) -> Bool
			in
			guard
				let client = await clientsManager.getClient(
					key: clientInstallationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			return try group.isSuperAdmin(inboxId: inboxId)
		}

		AsyncFunction("listAdmins") {
			(installationId: String, id: String) -> [String] in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			return try group.listAdmins()
		}

		AsyncFunction("listSuperAdmins") {
			(installationId: String, id: String) -> [String] in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			return try group.listSuperAdmins()
		}

		AsyncFunction("addAdmin") {
			(clientInstallationId: String, id: String, inboxId: String) in
			guard
				let client = await clientsManager.getClient(
					key: clientInstallationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.addAdmin(inboxId: inboxId)
		}

		AsyncFunction("addSuperAdmin") {
			(clientInstallationId: String, id: String, inboxId: String) in
			guard
				let client = await clientsManager.getClient(
					key: clientInstallationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.addSuperAdmin(inboxId: inboxId)
		}

		AsyncFunction("removeAdmin") {
			(clientInstallationId: String, id: String, inboxId: String) in
			guard
				let client = await clientsManager.getClient(
					key: clientInstallationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.removeAdmin(inboxId: inboxId)
		}

		AsyncFunction("removeSuperAdmin") {
			(clientInstallationId: String, id: String, inboxId: String) in
			guard
				let client = await clientsManager.getClient(
					key: clientInstallationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.removeSuperAdmin(inboxId: inboxId)
		}

		AsyncFunction("updateAddMemberPermission") {
			(clientInstallationId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(
					key: clientInstallationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateAddMemberPermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("updateRemoveMemberPermission") {
			(clientInstallationId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(
					key: clientInstallationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateRemoveMemberPermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("updateAddAdminPermission") {
			(clientInstallationId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(
					key: clientInstallationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateAddAdminPermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("updateRemoveAdminPermission") {
			(clientInstallationId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(
					key: clientInstallationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateRemoveAdminPermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("updateGroupNamePermission") {
			(clientInstallationId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(
					key: clientInstallationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateGroupNamePermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("updateGroupImageUrlSquarePermission") {
			(clientInstallationId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(
					key: clientInstallationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateGroupImageUrlSquarePermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("updateGroupDescriptionPermission") {
			(clientInstallationId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(
					key: clientInstallationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateGroupDescriptionPermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("permissionPolicySet") {
			(installationId: String, id: String) async throws -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let group = try await client.conversations.findGroup(
					groupId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			let permissionPolicySet = try group.permissionPolicySet()

			return try PermissionPolicySetWrapper.encodeToJsonString(
				permissionPolicySet)
		}

		AsyncFunction("processMessage") {
			(installationId: String, id: String, encryptedMessage: String)
				-> String? in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}

			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			guard
				let encryptedMessageData = Data(
					base64Encoded: Data(encryptedMessage.utf8))
			else {
				throw Error.noMessage
			}
			if let decodedMessage = try await conversation.processMessage(
				messageBytes: encryptedMessageData)
			{
				return try MessageWrapper.encode(
					decodedMessage)
			} else {
				return nil
			}
		}

		AsyncFunction("processWelcomeMessage") {
			(installationId: String, encryptedMessage: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			guard
				let encryptedMessageData = Data(
					base64Encoded: Data(encryptedMessage.utf8))
			else {
				throw Error.noMessage
			}
			guard
				let conversation = try await client.conversations.fromWelcome(
					envelopeBytes: encryptedMessageData)
			else {
				throw Error.conversationNotFound("no group found")
			}

			return try await ConversationWrapper.encode(
				conversation, client: client)
		}

		AsyncFunction("syncConsent") { (installationId: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}

			try await client.preferences.syncConsent()
		}

		AsyncFunction("setConsentState") {
			(
				installationId: String, value: String, entryType: String,
				consentType: String
			) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}

			let resolvedEntryType = try getEntryType(type: entryType)
			let resolvedConsentState = try getConsentState(state: consentType)

			try await client.preferences.setConsentState(
				entries: [
					ConsentRecord(
						value: value,
						entryType: resolvedEntryType,
						consentType: resolvedConsentState
					)
				]
			)
		}

		AsyncFunction("consentAddressState") {
			(installationId: String, address: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			return try await ConsentWrapper.consentStateToString(
				state: client.preferences.addressState(
					address: address))
		}

		AsyncFunction("consentInboxIdState") {
			(installationId: String, peerInboxId: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			return try await ConsentWrapper.consentStateToString(
				state: client.preferences.inboxIdState(
					inboxId: peerInboxId))
		}

		AsyncFunction("consentConversationIdState") {
			(installationId: String, conversationId: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}
			return try await ConsentWrapper.consentStateToString(
				state: client.preferences.conversationState(
					conversationId:
						conversationId))
		}

		AsyncFunction("conversationConsentState") {
			(installationId: String, conversationId: String) -> String in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}

			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(conversationId)")
			}
			return try ConsentWrapper.consentStateToString(
				state: conversation.consentState())
		}

		AsyncFunction("updateConversationConsent") {
			(installationId: String, conversationId: String, state: String) in
			guard
				let client = await clientsManager.getClient(key: installationId)
			else {
				throw Error.noClient
			}

			guard
				let conversation = try await client.conversations
					.findConversation(
						conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(conversationId)")
			}

			try await conversation.updateConsentState(
				state: getConsentState(state: state))
		}

		AsyncFunction("subscribeToPreferenceUpdates") {
			(installationId: String) in

			try await subscribeToPreferenceUpdates(
				installationId: installationId)
		}

		AsyncFunction("subscribeToConsent") {
			(installationId: String) in

			try await subscribeToConsent(
				installationId: installationId)
		}

		AsyncFunction("subscribeToConversations") {
			(installationId: String, type: String) in

			try await subscribeToConversations(
				installationId: installationId,
				type: getConversationType(type: type))
		}

		AsyncFunction("subscribeToAllMessages") {
			(installationId: String, type: String) in
			try await subscribeToAllMessages(
				installationId: installationId,
				type: getConversationType(type: type))
		}

		AsyncFunction("subscribeToMessages") {
			(installationId: String, id: String) in
			try await subscribeToMessages(
				installationId: installationId, id: id)
		}

		AsyncFunction("unsubscribeFromPreferenceUpdates") {
			(installationId: String) in
			await subscriptionsManager.get(
				getPreferenceUpdatesKey(installationId: installationId))?
				.cancel()
		}

		AsyncFunction("unsubscribeFromConsent") { (installationId: String) in
			await subscriptionsManager.get(
				getConsentKey(installationId: installationId))?
				.cancel()
		}

		AsyncFunction("unsubscribeFromConversations") {
			(installationId: String) in
			await subscriptionsManager.get(
				getConversationsKey(installationId: installationId))?.cancel()
		}

		AsyncFunction("unsubscribeFromAllMessages") {
			(installationId: String) in
			await subscriptionsManager.get(
				getMessagesKey(installationId: installationId))?
				.cancel()
		}

		AsyncFunction("unsubscribeFromMessages") {
			(installationId: String, id: String) in
			try await unsubscribeFromMessages(
				installationId: installationId, id: id)
		}

		AsyncFunction("registerPushToken") {
			(pushServer: String, token: String) in
			XMTPPush.shared.setPushServer(pushServer)
			do {
				try await XMTPPush.shared.register(token: token)
			} catch {
				print("Error registering: \(error)")
			}
		}

		AsyncFunction("subscribePushTopics") {
			(installationId: String, topics: [String]) in
			do {
				guard
					let client = await clientsManager.getClient(
						key: installationId)
				else {
					throw Error.noClient
				}
				let hmacKeysResult = try await client.conversations
					.getHmacKeys()
				let subscriptions = topics.map {
					topic -> NotificationSubscription in
					let hmacKeys = hmacKeysResult.hmacKeys

					let result = hmacKeys[topic]?.values.map {
						hmacKey -> NotificationSubscriptionHmacKey in
						NotificationSubscriptionHmacKey.with { sub_key in
							sub_key.key = hmacKey.hmacKey
							sub_key.thirtyDayPeriodsSinceEpoch = UInt32(
								hmacKey.thirtyDayPeriodsSinceEpoch)
						}
					}

					return NotificationSubscription.with { sub in
						sub.hmacKeys = result ?? []
						sub.topic = topic
					}
				}

				try await XMTPPush.shared.subscribeWithMetadata(
					subscriptions: subscriptions)
			} catch {
				print("Error subscribing: \(error)")
			}
		}

		AsyncFunction("exportNativeLogs") { () -> String in
			var logOutput = ""
			if #available(iOS 15.0, *) {
				do {
					let logStore = try OSLogStore(
						scope: .currentProcessIdentifier)
					let position = logStore.position(
						timeIntervalSinceLatestBoot: -300)  // Last 5 min of logs
					let entries = try logStore.getEntries(at: position)

					for entry in entries {
						if let logEntry = entry as? OSLogEntryLog {
							logOutput.append(
								"\(logEntry.date): \(logEntry.composedMessage)\n"
							)
						}
					}
				} catch {
					logOutput =
						"Failed to fetch logs: \(error.localizedDescription)"
				}
			} else {
				// Fallback for iOS 14
				logOutput =
					"OSLogStore is only available on iOS 15 and above. Logging is not supported on this iOS version."
			}

			return logOutput
		}
	}

	//
	// Helpers
	//

	private func getPermissionOption(permission: String) throws
		-> PermissionOption
	{
		switch permission {
		case "allow":
			return .allow
		case "deny":
			return .deny
		case "admin":
			return .admin
		case "super_admin":
			return .superAdmin
		default:
			throw Error.invalidPermissionOption
		}
	}

	private func getConsentState(state: String) throws -> ConsentState {
		switch state {
		case "allowed":
			return .allowed
		case "denied":
			return .denied
		default:
			return .unknown
		}
	}

	private func getConsentStates(states: [String]) throws -> [ConsentState] {
		return try states.map { state in
			try getConsentState(state: state)
		}
	}

	private func getEntryType(type: String) throws -> EntryType {
		switch type {
		case "inbox_id":
			return .inbox_id
		case "conversation_id":
			return .conversation_id
		case "address":
			return .address
		default:
			throw Error.invalidPermissionOption
		}
	}

	private func getSortDirection(direction: String) throws -> SortDirection {
		switch direction {
		case "ASCENDING":
			return .ascending
		default:
			return .descending
		}
	}

	private func getConversationType(type: String) throws -> ConversationType {
		switch type {
		case "groups":
			return .groups
		case "dms":
			return .dms
		default:
			return .all
		}
	}

	private func getPreferenceUpdatesType(type: PreferenceType) throws -> String
	{
		switch type {
		case .hmac_keys:
			return "hmac_keys"
		}
	}

	func createApiClient(env: String, appVersion: String? = nil)
		-> XMTP.ClientOptions.Api
	{
		switch env {
		case "local":
			return XMTP.ClientOptions.Api(
				env: XMTP.XMTPEnvironment.local,
				isSecure: false,
				appVersion: appVersion
			)
		case "production":
			return XMTP.ClientOptions.Api(
				env: XMTP.XMTPEnvironment.production,
				isSecure: true,
				appVersion: appVersion
			)
		default:
			return XMTP.ClientOptions.Api(
				env: XMTP.XMTPEnvironment.dev,
				isSecure: true,
				appVersion: appVersion
			)
		}
	}

	func createClientConfig(
		authParams: String, dbEncryptionKey: Data,
		preAuthenticateToInboxCallback: PreEventCallback? = nil
	) -> XMTP.ClientOptions {
		let authOptions = AuthParamsWrapper.authParamsFromJson(authParams)

		return XMTP.ClientOptions(
			api: createApiClient(
				env: authOptions.environment, appVersion: authOptions.appVersion
			),
			preAuthenticateToInboxCallback: preAuthenticateToInboxCallback,
			dbEncryptionKey: dbEncryptionKey,
			dbDirectory: authOptions.dbDirectory,
			historySyncUrl: authOptions.historySyncUrl)
	}

	func subscribeToPreferenceUpdates(installationId: String)
		async throws
	{
		guard let client = await clientsManager.getClient(key: installationId)
		else {
			return
		}

		await subscriptionsManager.get(
			getPreferenceUpdatesKey(installationId: installationId))?
			.cancel()
		await subscriptionsManager.set(
			getPreferenceUpdatesKey(installationId: installationId),
			Task {
				do {
					for try await pref in await client.preferences
						.streamPreferenceUpdates()
					{
						try sendEvent(
							"preferences",
							[
								"installationId": installationId,
								"type": getPreferenceUpdatesType(type: pref),
							])
					}
				} catch {
					print("Error in preference subscription: \(error)")
					await subscriptionsManager.get(
						getPreferenceUpdatesKey(installationId: installationId))?
						.cancel()
				}
			})
	}

	func subscribeToConsent(installationId: String)
		async throws
	{
		guard let client = await clientsManager.getClient(key: installationId)
		else {
			return
		}

		await subscriptionsManager.get(
			getConsentKey(installationId: installationId))?
			.cancel()
		await subscriptionsManager.set(
			getConsentKey(installationId: installationId),
			Task {
				do {
					for try await consent in await client.preferences
						.streamConsent()
					{
						try sendEvent(
							"consent",
							[
								"installationId": installationId,
								"consent": ConsentWrapper.encodeToObj(
									consent),
							])
					}
				} catch {
					print("Error in consent subscription: \(error)")
					await subscriptionsManager.get(
						getConsentKey(installationId: installationId))?.cancel()
				}
			})
	}

	func subscribeToConversations(
		installationId: String, type: ConversationType
	)
		async throws
	{
		guard let client = await clientsManager.getClient(key: installationId)
		else {
			return
		}

		await subscriptionsManager.get(
			getConversationsKey(installationId: installationId))?
			.cancel()
		await subscriptionsManager.set(
			getConversationsKey(installationId: installationId),
			Task {
				do {
					for try await conversation in await client.conversations
						.stream(type: type)
					{
						try await sendEvent(
							"conversation",
							[
								"installationId": installationId,
								"conversation": ConversationWrapper.encodeToObj(
									conversation, client: client),
							])
					}
				} catch {
					print("Error in all conversations subscription: \(error)")
					await subscriptionsManager.get(
						getConversationsKey(installationId: installationId))?
						.cancel()
				}
			})
	}

	func subscribeToAllMessages(installationId: String, type: ConversationType)
		async throws
	{
		guard let client = await clientsManager.getClient(key: installationId)
		else {
			return
		}

		await subscriptionsManager.get(
			getMessagesKey(installationId: installationId))?
			.cancel()
		await subscriptionsManager.set(
			getMessagesKey(installationId: installationId),
			Task {
				do {
					for try await message in await client.conversations
						.streamAllMessages(type: type)
					{
						try sendEvent(
							"message",
							[
								"installationId": installationId,
								"message": MessageWrapper.encodeToObj(
									message),
							])
					}
				} catch {
					print("Error in all messages subscription: \(error)")
					await subscriptionsManager.get(
						getMessagesKey(installationId: installationId))?
						.cancel()
				}
			})
	}

	func subscribeToMessages(installationId: String, id: String) async throws {
		guard let client = await clientsManager.getClient(key: installationId)
		else {
			throw Error.noClient
		}

		guard
			let converation = try await client.conversations.findConversation(
				conversationId: id)
		else {
			return
		}

		await subscriptionsManager.get(converation.cacheKey(installationId))?
			.cancel()
		await subscriptionsManager.set(
			converation.cacheKey(installationId),
			Task {
				do {
					for try await message in converation.streamMessages() {
						do {
							try sendEvent(
								"conversationMessage",
								[
									"installationId": installationId,
									"message":
										MessageWrapper.encodeToObj(
											message),
									"conversationId": id,
								])
						} catch {
							print(
								"discarding message, unable to encode wrapper \(message.id)"
							)
						}
					}
				} catch {
					print("Error in group messages subscription: \(error)")
					await subscriptionsManager.get(
						converation.cacheKey(installationId))?.cancel()
				}
			})
	}

	func unsubscribeFromMessages(installationId: String, id: String)
		async throws
	{
		guard let client = await clientsManager.getClient(key: installationId)
		else {
			throw Error.noClient
		}

		guard
			let converation = try await client.conversations.findConversation(
				conversationId: id)
		else {
			return
		}

		await subscriptionsManager.get(converation.cacheKey(installationId))?
			.cancel()
	}

	func getPreferenceUpdatesKey(installationId: String) -> String {
		return "preferences:\(installationId)"
	}

	func getConsentKey(installationId: String) -> String {
		return "consent:\(installationId)"
	}

	func getMessagesKey(installationId: String) -> String {
		return "messages:\(installationId)"
	}

	func getConversationsKey(installationId: String) -> String {
		return "conversations:\(installationId)"
	}

	func getConversationMessagesKey(installationId: String) -> String {
		return "conversationMessages:\(installationId)"
	}

	func preAuthenticateToInboxCallback() {
		sendEvent("preAuthenticateToInboxCallback")
		self.preAuthenticateToInboxCallbackDeferred?.wait()
	}
}
