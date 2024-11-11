import ExpoModulesCore
import LibXMTP
import OSLog
import XMTP

extension Conversation {
	static func cacheKeyForTopic(inboxId: String, topic: String) -> String {
		return "\(inboxId):\(topic)"
	}

	func cacheKey(_ inboxId: String) -> String {
		return Conversation.cacheKeyForTopic(inboxId: inboxId, topic: topic)
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

		// A method to update the client
		func updateClient(key: String, client: XMTP.Client) {
			ContentJson.initCodecs(client: client)
			clients[key] = client
		}

		// A method to drop client for a given key from memory
		func dropClient(key: String) {
			clients[key] = nil
		}

		// A method to retrieve a client
		func getClient(key: String) -> XMTP.Client? {
			return clients[key]
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

	enum Error: Swift.Error {
		case noClient
		case conversationNotFound(String)
		case noMessage, invalidKeyBundle, invalidDigest
		case badPreparation(String)
		case mlsNotEnabled(String)
		case invalidString, invalidPermissionOption
	}

	public func definition() -> ModuleDefinition {
		Name("XMTP")

		Events(
			"sign",
			"authed",
			"preAuthenticateToInboxCallback",
			"conversation",
			"message",
			"conversationMessage"
		)

		AsyncFunction("address") { (inboxId: String) -> String in
			if let client = await clientsManager.getClient(key: inboxId) {
				return client.address
			} else {
				return "No Client."
			}
		}

		AsyncFunction("inboxId") { (inboxId: String) -> String in
			if let client = await clientsManager.getClient(key: inboxId) {
				return client.inboxID
			} else {
				return "No Client."
			}
		}

		AsyncFunction("findInboxIdFromAddress") {
			(inboxId: String, address: String) -> String? in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			return try await client.inboxIdFromAddress(address: address)
		}

		AsyncFunction("deleteLocalDatabase") { (inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			try client.deleteLocalDatabase()
		}

		AsyncFunction("dropLocalDatabaseConnection") { (inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			try client.dropLocalDatabaseConnection()
		}

		AsyncFunction("reconnectLocalDatabase") { (inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			try await client.reconnectLocalDatabase()
		}

		AsyncFunction("requestMessageHistorySync") { (inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			try await client.requestMessageHistorySync()
		}

		AsyncFunction("revokeAllOtherInstallations") { (inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			let signer = ReactNativeSigner(
				module: self, address: client.address)
			self.signer = signer

			try await client.revokeAllOtherInstallations(signingKey: signer)
			self.signer = nil
		}

		AsyncFunction("getInboxState") {
			(inboxId: String, refreshFromNetwork: Bool) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			let inboxState = try await client.inboxState(
				refreshFromNetwork: refreshFromNetwork)
			return try InboxStateWrapper.encode(inboxState)
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
			let authOptions = AuthParamsWrapper.authParamsFromJson(authParams)

			let options = createClientConfig(
				env: authOptions.environment,
				appVersion: authOptions.appVersion,
				preAuthenticateToInboxCallback: preAuthenticateToInboxCallback,
				dbEncryptionKey: encryptionKeyData,
				dbDirectory: authOptions.dbDirectory,
				historySyncUrl: authOptions.historySyncUrl
			)
			let client = try await Client.create(
				account: privateKey, options: options)

			await clientsManager.updateClient(
				key: client.inboxID, client: client)
			return try ClientWrapper.encodeToObj(client)
		}

		AsyncFunction("create") {
			(
				address: String, hasAuthenticateToInboxCallback: Bool?,
				dbEncryptionKey: [UInt8], authParams: String
			) in
			let authOptions = AuthParamsWrapper.authParamsFromJson(authParams)
			let signer = ReactNativeSigner(
				module: self, address: address,
				walletType: authOptions.walletType,
				chainId: authOptions.chainId,
				blockNumber: authOptions.blockNumber)
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
				env: authOptions.environment,
				appVersion: authOptions.appVersion,
				preAuthenticateToInboxCallback: preAuthenticateToInboxCallback,
				dbEncryptionKey: encryptionKeyData,
				dbDirectory: authOptions.dbDirectory,
				historySyncUrl: authOptions.historySyncUrl
			)
			let client = try await XMTP.Client.create(
				account: signer, options: options)
			await self.clientsManager.updateClient(
				key: client.inboxID, client: client)
			self.signer = nil
			self.sendEvent("authed", try ClientWrapper.encodeToObj(client))
		}

		AsyncFunction("build") {
			(address: String, dbEncryptionKey: [UInt8], authParams: String)
				-> [String: String] in
			let authOptions = AuthParamsWrapper.authParamsFromJson(authParams)
			let encryptionKeyData = Data(dbEncryptionKey)

			let options = self.createClientConfig(
				env: authOptions.environment,
				appVersion: authOptions.appVersion,
				preAuthenticateToInboxCallback: nil,
				dbEncryptionKey: encryptionKeyData,
				dbDirectory: authOptions.dbDirectory,
				historySyncUrl: authOptions.historySyncUrl
			)
			let client = try await XMTP.Client.build(
				address: address, options: options)
			await clientsManager.updateClient(
				key: client.inboxID, client: client)
			return try ClientWrapper.encodeToObj(client)
		}

		// Remove a client from memory for a given inboxId
		AsyncFunction("dropClient") { (inboxId: String) in
			await clientsManager.dropClient(key: inboxId)
		}

		AsyncFunction("canMessage") {
			(inboxId: String, peerAddresses: [String]) -> [String: Bool] in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}

			return try await client.canMessage(addresses: peerAddresses)
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
			(inboxId: String, fileJson: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
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
				codec: AttachmentCodec(),
				with: client
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
			(inboxId: String, encryptedFileJson: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
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
			let attachment: Attachment = try encoded.decoded(with: client)
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
				inboxId: String, groupParams: String?, sortOrder: String?,
				limit: Int?
			) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}

			let params = ConversationParamsWrapper.conversationParamsFromJson(
				groupParams ?? "")
			let order = getConversationSortOrder(order: sortOrder ?? "")

			var groupList: [Group] = try await client.conversations.listGroups(
				limit: limit, order: order)

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
				inboxId: String, groupParams: String?, sortOrder: String?,
				limit: Int?
			) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}

			let params = ConversationParamsWrapper.conversationParamsFromJson(
				groupParams ?? "")
			let order = getConversationSortOrder(order: sortOrder ?? "")

			var dmList: [Dm] = try await client.conversations.listDms(
				limit: limit, order: order)

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
				inboxId: String, conversationParams: String?,
				sortOrder: String?, limit: Int?
			) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}

			let params = ConversationParamsWrapper.conversationParamsFromJson(
				conversationParams ?? "")
			let order = getConversationSortOrder(order: sortOrder ?? "")
			let conversations = try await client.conversations.list(
				limit: limit, order: order)

			var results: [String] = []
			for conversation in conversations {
				let encodedConversationContainer =
					try await ConversationWrapper.encode(
						conversation, client: client)
				results.append(encodedConversationContainer)
			}
			return results
		}

		AsyncFunction("conversationMessages") {
			(
				inboxId: String, conversationId: String, limit: Int?,
				beforeNs: Double?, afterNs: Double?, direction: String?
			) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}

			guard
				let conversation = try client.findConversation(
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
					return try DecodedMessageWrapper.encode(msg, client: client)
				} catch {
					print(
						"discarding message, unable to encode wrapper \(msg.id)"
					)
					return nil
				}
			}
		}

		AsyncFunction("findMessage") {
			(inboxId: String, messageId: String) -> String? in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			if let message = try client.findMessage(messageId: messageId) {
				return try DecodedMessageWrapper.encode(
					message.decode(), client: client)
			} else {
				return nil
			}
		}

		AsyncFunction("findGroup") {
			(inboxId: String, groupId: String) -> String? in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			if let group = try client.findGroup(groupId: groupId) {
				return try await GroupWrapper.encode(group, client: client)
			} else {
				return nil
			}
		}

		AsyncFunction("findConversation") {
			(inboxId: String, conversationId: String) -> String? in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}

			if let conversation = try client.findConversation(
				conversationId: conversationId)
			{
				return try await ConversationWrapper.encode(
					conversation, client: client)
			} else {
				return nil
			}
		}

		AsyncFunction("findConversationByTopic") {
			(inboxId: String, topic: String) -> String? in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			if let conversation = try client.findConversationByTopic(
				topic: topic)
			{
				return try await ConversationWrapper.encode(
					conversation, client: client)
			} else {
				return nil
			}
		}

		AsyncFunction("findDm") {
			(inboxId: String, peerAddress: String) -> String? in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			if let dm = try await client.findDm(address: peerAddress) {
				return try await DmWrapper.encode(dm, client: client)
			} else {
				return nil
			}
		}

		AsyncFunction("sendMessage") {
			(inboxId: String, id: String, contentJson: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try client.findConversation(
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
			(inboxId: String, id: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try client.findConversation(
					conversationId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			try await conversation.publishMessages()
		}

		AsyncFunction("prepareMessage") {
			(inboxId: String, id: String, contentJson: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try client.findConversation(
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

		AsyncFunction("findOrCreateDm") {
			(inboxId: String, peerAddress: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}

			do {
				let dm = try await client.conversations.findOrCreateDm(
					with: peerAddress)
				return try await DmWrapper.encode(dm, client: client)
			} catch {
				print("ERRRO!: \(error.localizedDescription)")
				throw error
			}
		}

		AsyncFunction("createGroup") {
			(
				inboxId: String, peerAddresses: [String], permission: String,
				groupOptionsJson: String
			) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
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
					pinnedFrameUrl: createGroupParams.groupPinnedFrameUrl
				)
				return try await GroupWrapper.encode(group, client: client)
			} catch {
				print("ERRRO!: \(error.localizedDescription)")
				throw error
			}
		}

		AsyncFunction("createGroupCustomPermissions") {
			(
				inboxId: String, peerAddresses: [String],
				permissionPolicySetJson: String, groupOptionsJson: String
			) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
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
						pinnedFrameUrl: createGroupParams.groupPinnedFrameUrl
					)
				return try await GroupWrapper.encode(group, client: client)
			} catch {
				print("ERRRO!: \(error.localizedDescription)")
				throw error
			}
		}

		AsyncFunction("listMemberInboxIds") {
			(inboxId: String, groupId: String) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: groupId) else {
				throw Error.conversationNotFound(
					"no conversation found for \(groupId)")
			}
			return try await group.members.map(\.inboxId)
		}

		AsyncFunction("dmPeerInboxId") {
			(inboxId: String, dmId: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try client.findConversation(
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
			(inboxId: String, conversationId: String) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}

			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try client.findConversation(
					conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(conversationId)")
			}
			return try await conversation.members().compactMap { member in
				return try MemberWrapper.encode(member)
			}
		}

		AsyncFunction("syncConversations") { (inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			try await client.conversations.sync()
		}

		AsyncFunction("syncAllConversations") { (inboxId: String) -> UInt32 in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			return try await client.conversations.syncAllConversations()
		}

		AsyncFunction("syncConversation") { (inboxId: String, id: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard
				let conversation = try client.findConversation(
					conversationId: id)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await conversation.sync()
		}

		AsyncFunction("addGroupMembers") {
			(inboxId: String, id: String, peerAddresses: [String]) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.addMembers(addresses: peerAddresses)
		}

		AsyncFunction("removeGroupMembers") {
			(inboxId: String, id: String, peerAddresses: [String]) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.removeMembers(addresses: peerAddresses)
		}

		AsyncFunction("addGroupMembersByInboxId") {
			(inboxId: String, id: String, inboxIds: [String]) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.addMembersByInboxId(inboxIds: inboxIds)
		}

		AsyncFunction("removeGroupMembersByInboxId") {
			(inboxId: String, id: String, inboxIds: [String]) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			try await group.removeMembersByInboxId(inboxIds: inboxIds)
		}

		AsyncFunction("groupName") { (inboxId: String, id: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			return try group.groupName()
		}

		AsyncFunction("updateGroupName") {
			(inboxId: String, id: String, groupName: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			try await group.updateGroupName(groupName: groupName)
		}

		AsyncFunction("groupImageUrlSquare") {
			(inboxId: String, id: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			return try group.groupImageUrlSquare()
		}

		AsyncFunction("updateGroupImageUrlSquare") {
			(inboxId: String, id: String, groupImageUrl: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			try await group.updateGroupImageUrlSquare(
				imageUrlSquare: groupImageUrl)
		}

		AsyncFunction("groupDescription") {
			(inboxId: String, id: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			return try group.groupDescription()
		}

		AsyncFunction("updateGroupDescription") {
			(inboxId: String, id: String, description: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			try await group.updateGroupDescription(
				groupDescription: description)
		}

		AsyncFunction("groupPinnedFrameUrl") {
			(inboxId: String, id: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			return try group.groupPinnedFrameUrl()
		}

		AsyncFunction("updateGroupPinnedFrameUrl") {
			(inboxId: String, id: String, pinnedFrameUrl: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			try await group.updateGroupPinnedFrameUrl(
				groupPinnedFrameUrl: pinnedFrameUrl)
		}

		AsyncFunction("isGroupActive") {
			(inboxId: String, id: String) -> Bool in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			return try group.isActive()
		}

		AsyncFunction("addedByInboxId") {
			(inboxId: String, id: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			return try group.addedByInboxId()
		}

		AsyncFunction("creatorInboxId") {
			(inboxId: String, id: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			return try group.creatorInboxId()
		}

		AsyncFunction("isAdmin") {
			(clientInboxId: String, id: String, inboxId: String) -> Bool in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			return try group.isAdmin(inboxId: inboxId)
		}

		AsyncFunction("isSuperAdmin") {
			(clientInboxId: String, id: String, inboxId: String) -> Bool in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			return try group.isSuperAdmin(inboxId: inboxId)
		}

		AsyncFunction("listAdmins") {
			(inboxId: String, id: String) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			return try group.listAdmins()
		}

		AsyncFunction("listSuperAdmins") {
			(inboxId: String, id: String) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			return try group.listSuperAdmins()
		}

		AsyncFunction("addAdmin") {
			(clientInboxId: String, id: String, inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.addAdmin(inboxId: inboxId)
		}

		AsyncFunction("addSuperAdmin") {
			(clientInboxId: String, id: String, inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.addSuperAdmin(inboxId: inboxId)
		}

		AsyncFunction("removeAdmin") {
			(clientInboxId: String, id: String, inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.removeAdmin(inboxId: inboxId)
		}

		AsyncFunction("removeSuperAdmin") {
			(clientInboxId: String, id: String, inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.removeSuperAdmin(inboxId: inboxId)
		}

		AsyncFunction("updateAddMemberPermission") {
			(clientInboxId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(key: clientInboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateAddMemberPermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("updateRemoveMemberPermission") {
			(clientInboxId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(key: clientInboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateRemoveMemberPermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("updateAddAdminPermission") {
			(clientInboxId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(key: clientInboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateAddAdminPermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("updateRemoveAdminPermission") {
			(clientInboxId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(key: clientInboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateRemoveAdminPermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("updateGroupNamePermission") {
			(clientInboxId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(key: clientInboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateGroupNamePermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("updateGroupImageUrlSquarePermission") {
			(clientInboxId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(key: clientInboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateGroupImageUrlSquarePermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("updateGroupDescriptionPermission") {
			(clientInboxId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(key: clientInboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateGroupDescriptionPermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("updateGroupPinnedFrameUrlPermission") {
			(clientInboxId: String, id: String, newPermission: String) in
			guard
				let client = await clientsManager.getClient(key: clientInboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}
			try await group.updateGroupPinnedFrameUrlPermission(
				newPermissionOption: getPermissionOption(
					permission: newPermission))
		}

		AsyncFunction("permissionPolicySet") {
			(inboxId: String, id: String) async throws -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			guard let group = try client.findGroup(groupId: id) else {
				throw Error.conversationNotFound(
					"no conversation found for \(id)")
			}

			let permissionPolicySet = try group.permissionPolicySet()

			return try PermissionPolicySetWrapper.encodeToJsonString(
				permissionPolicySet)
		}

		AsyncFunction("processMessage") {
			(inboxId: String, id: String, encryptedMessage: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}

			guard
				let conversation = try client.findConversation(
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
			let decodedMessage = try await conversation.processMessage(
				messageBytes: encryptedMessageData)
			return try DecodedMessageWrapper.encode(
				decodedMessage.decode(), client: client)
		}

		AsyncFunction("processWelcomeMessage") {
			(inboxId: String, encryptedMessage: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
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

		AsyncFunction("setConsentState") {
			(
				inboxId: String, value: String, entryType: String,
				consentType: String
			) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}

			let resolvedEntryType = try getEntryType(type: entryType)
			let resolvedConsentState = try getConsentState(state: consentType)

			try await client.preferences.consentList.setConsentState(
				entries: [
					ConsentListEntry(
						value: value,
						entryType: resolvedEntryType,
						consentType: resolvedConsentState
					)
				]
			)
		}

		AsyncFunction("consentAddressState") {
			(inboxId: String, address: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			return try await ConsentWrapper.consentStateToString(
				state: client.preferences.consentList.addressState(
					address: address))
		}

		AsyncFunction("consentInboxIdState") {
			(inboxId: String, peerInboxId: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			return try await ConsentWrapper.consentStateToString(
				state: client.preferences.consentList.inboxIdState(
					inboxId: peerInboxId))
		}

		AsyncFunction("consentConversationIdState") {
			(inboxId: String, conversationId: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}
			return try await ConsentWrapper.consentStateToString(
				state: client.preferences.consentList.conversationState(
					conversationId:
						conversationId))
		}

		AsyncFunction("conversationConsentState") {
			(inboxId: String, conversationId: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}

			guard
				let conversation = try client.findConversation(
					conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(conversationId)")
			}
			return try ConsentWrapper.consentStateToString(
				state: conversation.consentState())
		}

		AsyncFunction("updateConversationConsent") {
			(inboxId: String, conversationId: String, state: String) in
			guard let client = await clientsManager.getClient(key: inboxId)
			else {
				throw Error.noClient
			}

			guard
				let conversation = try client.findConversation(
					conversationId: conversationId)
			else {
				throw Error.conversationNotFound(
					"no conversation found for \(conversationId)")
			}

			try await conversation.updateConsentState(
				state: getConsentState(state: state))
		}

		AsyncFunction("subscribeToConversations") {
			(inboxId: String, type: String) in

			try await subscribeToConversations(
				inboxId: inboxId, type: getConversationType(type: type))
		}

		AsyncFunction("subscribeToAllMessages") {
			(inboxId: String, type: String) in
			try await subscribeToAllMessages(
				inboxId: inboxId, type: getConversationType(type: type))
		}

		AsyncFunction("subscribeToMessages") {
			(inboxId: String, id: String) in
			try await subscribeToMessages(inboxId: inboxId, id: id)
		}

		AsyncFunction("unsubscribeFromConversations") { (inboxId: String) in
			await subscriptionsManager.get(
				getConversationsKey(inboxId: inboxId))?.cancel()
		}

		AsyncFunction("unsubscribeFromAllMessages") { (inboxId: String) in
			await subscriptionsManager.get(getMessagesKey(inboxId: inboxId))?
				.cancel()
		}

		AsyncFunction("unsubscribeFromMessages") {
			(inboxId: String, id: String) in
			try await unsubscribeFromMessages(inboxId: inboxId, id: id)
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

		AsyncFunction("subscribePushTopics") { (topics: [String]) in
			do {
				let subscriptions = topics.map {
					topic -> NotificationSubscription in
					return NotificationSubscription.with { sub in
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
						if let logEntry = entry as? OSLogEntryLog,
							logEntry.composedMessage.contains("libxmtp")
						{
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

		OnAppBecomesActive {
			Task {
				try await clientsManager.reconnectAllLocalDatabaseConnections()
			}
		}

		OnAppEntersBackground {
			Task {
				try await clientsManager.dropAllLocalDatabaseConnections()
			}
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

	private func getConversationSortOrder(order: String) -> ConversationOrder {
		switch order {
		case "lastMessage":
			return .lastMessage
		default:
			return .createdAt
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
		env: String, appVersion: String?,
		preAuthenticateToInboxCallback: PreEventCallback? = nil,
		dbEncryptionKey: Data, dbDirectory: String? = nil,
		historySyncUrl: String? = nil
	) -> XMTP.ClientOptions {

		return XMTP.ClientOptions(
			api: createApiClient(env: env, appVersion: appVersion),
			preAuthenticateToInboxCallback: preAuthenticateToInboxCallback,
			dbEncryptionKey: dbEncryptionKey, dbDirectory: dbDirectory,
			historySyncUrl: historySyncUrl)
	}

	func subscribeToConversations(inboxId: String, type: ConversationType)
		async throws
	{
		guard let client = await clientsManager.getClient(key: inboxId) else {
			return
		}

		await subscriptionsManager.get(getConversationsKey(inboxId: inboxId))?
			.cancel()
		await subscriptionsManager.set(
			getConversationsKey(inboxId: inboxId),
			Task {
				do {
					for try await conversation in await client.conversations
						.stream(type: type)
					{
						try await sendEvent(
							"conversation",
							[
								"inboxId": inboxId,
								"conversation": ConversationWrapper.encodeToObj(
									conversation, client: client),
							])
					}
				} catch {
					print("Error in all conversations subscription: \(error)")
					await subscriptionsManager.get(
						getConversationsKey(inboxId: inboxId))?.cancel()
				}
			})
	}

	func subscribeToAllMessages(inboxId: String, type: ConversationType)
		async throws
	{
		guard let client = await clientsManager.getClient(key: inboxId) else {
			return
		}

		await subscriptionsManager.get(getMessagesKey(inboxId: inboxId))?
			.cancel()
		await subscriptionsManager.set(
			getMessagesKey(inboxId: inboxId),
			Task {
				do {
					for try await message in await client.conversations
						.streamAllMessages(type: type)
					{
						try sendEvent(
							"message",
							[
								"inboxId": inboxId,
								"message": DecodedMessageWrapper.encodeToObj(
									message, client: client),
							])
					}
				} catch {
					print("Error in all messages subscription: \(error)")
					await subscriptionsManager.get(
						getMessagesKey(inboxId: inboxId))?.cancel()
				}
			})
	}

	func subscribeToMessages(inboxId: String, id: String) async throws {
		guard let client = await clientsManager.getClient(key: inboxId) else {
			throw Error.noClient
		}

		guard let converation = try client.findConversation(conversationId: id)
		else {
			return
		}

		await subscriptionsManager.get(converation.cacheKey(client.inboxID))?
			.cancel()
		await subscriptionsManager.set(
			converation.cacheKey(client.inboxID),
			Task {
				do {
					for try await message in converation.streamMessages() {
						do {
							try sendEvent(
								"conversationMessage",
								[
									"inboxId": inboxId,
									"message":
										DecodedMessageWrapper.encodeToObj(
											message, client: client),
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
						converation.cacheKey(inboxId))?.cancel()
				}
			})
	}

	func unsubscribeFromMessages(inboxId: String, id: String) async throws {
		guard let client = await clientsManager.getClient(key: inboxId) else {
			throw Error.noClient
		}

		guard let converation = try client.findConversation(conversationId: id)
		else {
			return
		}

		await subscriptionsManager.get(converation.cacheKey(inboxId))?
			.cancel()
	}

	func getMessagesKey(inboxId: String) -> String {
		return "messages:\(inboxId)"
	}

	func getConversationsKey(inboxId: String) -> String {
		return "conversations:\(inboxId)"
	}

	func getConversationMessagesKey(inboxId: String) -> String {
		return "conversationMessages:\(inboxId)"
	}

	func preAuthenticateToInboxCallback() {
		sendEvent("preAuthenticateToInboxCallback")
		self.preAuthenticateToInboxCallbackDeferred?.wait()
	}
}
