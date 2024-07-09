import ExpoModulesCore
import XMTP
import LibXMTP

extension Conversation {
	static func cacheKeyForTopic(inboxId: String, topic: String) -> String {
		return "\(inboxId):\(topic)"
	}

	func cacheKey(_ inboxId: String) -> String {
		return Conversation.cacheKeyForTopic(inboxId: inboxId, topic: topic)
	}
}

extension XMTP.Group {
	static func cacheKeyForId(inboxId: String, id: String) -> String {
		return "\(inboxId):\(id)"
	}
	
	func cacheKey(_ inboxId: String) -> String {
		return XMTP.Group.cacheKeyForId(inboxId: inboxId, id: id.toHex)
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
	let conversationsManager = IsolatedManager<Conversation>()
	let groupsManager = IsolatedManager<XMTP.Group>()
	let subscriptionsManager = IsolatedManager<Task<Void, Never>>()
	private var preEnableIdentityCallbackDeferred: DispatchSemaphore?
	private var preCreateIdentityCallbackDeferred: DispatchSemaphore?

	actor ClientsManager {
		private var clients: [String: XMTP.Client] = [:]

		// A method to update the conversations
		func updateClient(key: String, client: XMTP.Client) {
			ContentJson.initCodecs(client: client)
			clients[key] = client
		}

		// A method to retrieve a conversation
		func getClient(key: String) -> XMTP.Client? {
			return clients[key]
		}
	}

	enum Error: Swift.Error {
		case noClient, conversationNotFound(String), noMessage, invalidKeyBundle, invalidDigest, badPreparation(String), mlsNotEnabled(String), invalidString, invalidPermissionOption
	}

	public func definition() -> ModuleDefinition {
		Name("XMTP")

		Events(
            // Auth
            "sign",
            "authed",
            "preCreateIdentityCallback",
            "preEnableIdentityCallback",
            // Conversations
            "conversation",
            "group",
            "conversationContainer",
            "message",
            "allGroupMessage",
            // Conversation
            "conversationMessage",
            // Group
            "groupMessage"
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
		
		AsyncFunction("findInboxIdFromAddress") { (inboxId: String, address: String) -> String? in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			return try await client.inboxIdFromAddress(address: address)
		}

		AsyncFunction("deleteLocalDatabase") { (inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			try client.deleteLocalDatabase()
		}
		
		AsyncFunction("dropLocalDatabaseConnection") { (inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			try client.dropLocalDatabaseConnection()
		}
		
		AsyncFunction("reconnectLocalDatabase") { (inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			try await client.reconnectLocalDatabase()
		}
		
		AsyncFunction("requestMessageHistorySync") { (inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			try await client.requestMessageHistorySync()
		}

		//
		// Auth functions
		//
		AsyncFunction("auth") { (address: String, hasCreateIdentityCallback: Bool?, hasEnableIdentityCallback: Bool?, dbEncryptionKey: [UInt8]?, authParams: String) in
			let signer = ReactNativeSigner(module: self, address: address)
			self.signer = signer
			if(hasCreateIdentityCallback ?? false) {
				self.preCreateIdentityCallbackDeferred = DispatchSemaphore(value: 0)
			}
			if(hasEnableIdentityCallback ?? false) {
				self.preEnableIdentityCallbackDeferred = DispatchSemaphore(value: 0)
			}
			let preCreateIdentityCallback: PreEventCallback? = hasCreateIdentityCallback ?? false ? self.preCreateIdentityCallback : nil
			let preEnableIdentityCallback: PreEventCallback? = hasEnableIdentityCallback ?? false ? self.preEnableIdentityCallback : nil
			let encryptionKeyData = dbEncryptionKey == nil ? nil : Data(dbEncryptionKey!)
			let authOptions = AuthParamsWrapper.authParamsFromJson(authParams)
			
			let options = self.createClientConfig(env: authOptions.environment, appVersion: authOptions.appVersion, preEnableIdentityCallback: preEnableIdentityCallback, preCreateIdentityCallback: preCreateIdentityCallback, enableV3: authOptions.enableV3, dbEncryptionKey: encryptionKeyData, dbDirectory: authOptions.dbDirectory, historySyncUrl: authOptions.historySyncUrl)
			let client = try await XMTP.Client.create(account: signer, options: options)
			await self.clientsManager.updateClient(key: client.inboxID, client: client)
			self.signer = nil
			self.sendEvent("authed", try ClientWrapper.encodeToObj(client))
		}

		Function("receiveSignature") { (requestID: String, signature: String) in
			try signer?.handle(id: requestID, signature: signature)
		}

		// Generate a random wallet and set the client to that
		AsyncFunction("createRandom") { (hasCreateIdentityCallback: Bool?, hasEnableIdentityCallback: Bool?, dbEncryptionKey: [UInt8]?, authParams: String) -> [String: String] in

			let privateKey = try PrivateKey.generate()
			if(hasCreateIdentityCallback ?? false) {
				preCreateIdentityCallbackDeferred = DispatchSemaphore(value: 0)
			}
			if(hasEnableIdentityCallback ?? false) {
				preEnableIdentityCallbackDeferred = DispatchSemaphore(value: 0)
			}
			let preCreateIdentityCallback: PreEventCallback? = hasCreateIdentityCallback ?? false ? self.preCreateIdentityCallback : nil
			let preEnableIdentityCallback: PreEventCallback? = hasEnableIdentityCallback ?? false ? self.preEnableIdentityCallback : nil
			let encryptionKeyData = dbEncryptionKey == nil ? nil : Data(dbEncryptionKey!)
			let authOptions = AuthParamsWrapper.authParamsFromJson(authParams)

			let options = createClientConfig(env: authOptions.environment, appVersion: authOptions.appVersion, preEnableIdentityCallback: preEnableIdentityCallback, preCreateIdentityCallback: preCreateIdentityCallback, enableV3: authOptions.enableV3, dbEncryptionKey: encryptionKeyData, dbDirectory: authOptions.dbDirectory, historySyncUrl: authOptions.historySyncUrl)
			let client = try await Client.create(account: privateKey, options: options)

			await clientsManager.updateClient(key: client.inboxID, client: client)
			return try ClientWrapper.encodeToObj(client)
		}

		// Create a client using its serialized key bundle.
		AsyncFunction("createFromKeyBundle") { (keyBundle: String, dbEncryptionKey: [UInt8]?, authParams: String) -> [String: String] in

			do {
				guard let keyBundleData = Data(base64Encoded: keyBundle),
				      let bundle = try? PrivateKeyBundle(serializedData: keyBundleData)
				else {
					throw Error.invalidKeyBundle
				}
				let encryptionKeyData = dbEncryptionKey == nil ? nil : Data(dbEncryptionKey!)
				let authOptions = AuthParamsWrapper.authParamsFromJson(authParams)

				let options = createClientConfig(env: authOptions.environment, appVersion: authOptions.appVersion, enableV3: authOptions.enableV3, dbEncryptionKey: encryptionKeyData, dbDirectory: authOptions.dbDirectory, historySyncUrl: authOptions.historySyncUrl)
				let client = try await Client.from(bundle: bundle, options: options)
				await clientsManager.updateClient(key: client.inboxID, client: client)
				return try ClientWrapper.encodeToObj(client)
			} catch {
				print("ERRO! Failed to create client: \(error)")
				throw error
			}
		}
		
		AsyncFunction("sign") { (inboxId: String, digest: [UInt8], keyType: String, preKeyIndex: Int) -> [UInt8] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			let privateKeyBundle = client.keys
			let key = keyType == "prekey" ? privateKeyBundle.preKeys[preKeyIndex] : privateKeyBundle.identityKey

			let privateKey = try PrivateKey(key)
			let signature = try await privateKey.sign(Data(digest))
			let uint = try [UInt8](signature.serializedData())
			return uint
		}
		
		AsyncFunction("exportPublicKeyBundle") { (inboxId: String) -> [UInt8] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			let bundle = try client.publicKeyBundle.serializedData()
			return Array(bundle)
		}

		// Export the client's serialized key bundle.
		AsyncFunction("exportKeyBundle") { (inboxId: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			let bundle = try client.privateKeyBundle.serializedData().base64EncodedString()
			return bundle
		}

		// Export the conversation's serialized topic data.
		AsyncFunction("exportConversationTopicData") { (inboxId: String, topic: String) -> String in
			guard let conversation = try await findConversation(inboxId: inboxId, topic: topic) else {
				throw Error.conversationNotFound(topic)
			}
			return try conversation.toTopicData().serializedData().base64EncodedString()
		}
		
		AsyncFunction("getHmacKeys") { (inboxId: String) -> [UInt8] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			let hmacKeys = await client.conversations.getHmacKeys()
			
			return try [UInt8](hmacKeys.serializedData())
		}

		// Import a conversation from its serialized topic data.
		AsyncFunction("importConversationTopicData") { (inboxId: String, topicData: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			let data = try Xmtp_KeystoreApi_V1_TopicMap.TopicData(
				serializedData: Data(base64Encoded: Data(topicData.utf8))!
			)
			let conversation = await client.conversations.importTopicData(data: data)
			await conversationsManager.set(conversation.cacheKey(inboxId), conversation)
			return try ConversationWrapper.encode(conversation, client: client)
		}

		//
		// Client API
		AsyncFunction("canMessage") { (inboxId: String, peerAddress: String) -> Bool in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			return try await client.canMessage(peerAddress)
		}
		
		AsyncFunction("canGroupMessage") { (inboxId: String, peerAddresses: [String]) -> [String: Bool] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			return try await client.canMessageV3(addresses: peerAddresses)
		}

		AsyncFunction("staticCanMessage") { (peerAddress: String, environment: String, appVersion: String?) -> Bool in
			do {
				let options = createClientConfig(env: environment, appVersion: appVersion)
				return try await XMTP.Client.canMessage(peerAddress, options: options)
			} catch {
				throw Error.noClient
			}
		}

		AsyncFunction("encryptAttachment") { (inboxId: String, fileJson: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId) else {
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
			let encryptedFile = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
			try encrypted.payload.write(to: encryptedFile)

			return try EncryptedLocalAttachment.from(
				attachment: attachment,
				encrypted: encrypted,
				encryptedFile: encryptedFile
			).toJson()
		}

		AsyncFunction("decryptAttachment") { (inboxId: String, encryptedFileJson: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			let encryptedFile = try EncryptedLocalAttachment.fromJson(encryptedFileJson)
			let encryptedData = try Data(contentsOf: URL(string: encryptedFile.encryptedLocalFileUri)!)

			let encrypted = EncryptedEncodedContent(
				secret: encryptedFile.metadata.secret,
				digest: encryptedFile.metadata.contentDigest,
				salt: encryptedFile.metadata.salt,
				nonce: encryptedFile.metadata.nonce,
				payload: encryptedData
			)
			let encoded = try RemoteAttachment.decryptEncoded(encrypted: encrypted)
			let attachment: Attachment = try encoded.decoded(with: client)
			let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
			try attachment.data.write(to: file)
			return try DecryptedLocalAttachment(
				fileUri: file.absoluteString,
				mimeType: attachment.mimeType,
				filename: attachment.filename
			).toJson()
		}

		AsyncFunction("sendEncodedContent") { (inboxId: String, topic: String, encodedContentData: [UInt8]) -> String in
			guard let conversation = try await findConversation(inboxId: inboxId, topic: topic) else {
				throw Error.conversationNotFound("no conversation found for \(topic)")
			}

			let encodedContent = try EncodedContent(serializedData: Data(encodedContentData))

			return try await conversation.send(encodedContent: encodedContent)
		}

		AsyncFunction("listConversations") { (inboxId: String) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			let conversations = try await client.conversations.list()

			return try await withThrowingTaskGroup(of: String.self) { group in
				for conversation in conversations {
					group.addTask {
						await self.conversationsManager.set(conversation.cacheKey(inboxId), conversation)
						return try ConversationWrapper.encode(conversation, client: client)
					}
				}

				var results: [String] = []
				for try await result in group {
					results.append(result)
				}

				return results
			}
		}
		
		AsyncFunction("listGroups") { (inboxId: String) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			let groupList = try await client.conversations.groups()
			return try await withThrowingTaskGroup(of: String.self) { taskGroup in
				for group in groupList {
					taskGroup.addTask {
						await self.groupsManager.set(group.cacheKey(inboxId), group)
						return try GroupWrapper.encode(group, client: client)
					}
				}

				var results: [String] = []
				for try await result in taskGroup {
					results.append(result)
				}

				return results
			}
		}
		
		AsyncFunction("listAll") { (inboxId: String) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			let conversationContainerList = try await client.conversations.list(includeGroups: true)
			
			return try await withThrowingTaskGroup(of: String.self) { taskGroup in
				for conversation in conversationContainerList {
					taskGroup.addTask {
						await self.conversationsManager.set(conversation.cacheKey(inboxId), conversation)
						return try ConversationContainerWrapper.encode(conversation, client: client)
					}
				}

				var results: [String] = []
				for try await result in taskGroup {
					results.append(result)
				}

				return results
			}
		}

		AsyncFunction("loadMessages") { (inboxId: String, topic: String, limit: Int?, before: Double?, after: Double?, direction: String?) -> [String] in
			let beforeDate = before != nil ? Date(timeIntervalSince1970: TimeInterval(before!) / 1000) : nil
			let afterDate = after != nil ? Date(timeIntervalSince1970: TimeInterval(after!) / 1000) : nil

			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let conversation = try await findConversation(inboxId: inboxId, topic: topic) else {
				throw Error.conversationNotFound("no conversation found for \(topic)")
			}

			let sortDirection: Int = (direction != nil && direction == "SORT_DIRECTION_ASCENDING") ? 1 : 2

			let decryptedMessages = try await conversation.decryptedMessages(
				limit: limit,
				before: beforeDate,
				after: afterDate,
				direction: PagingInfoSortDirection(rawValue: sortDirection)
			)

			return decryptedMessages.compactMap { msg in
				do {
					return try DecodedMessageWrapper.encode(msg, client: client)
				} catch {
					print("discarding message, unable to encode wrapper \(msg.id)")
					return nil
				}
			}
		}
		
		AsyncFunction("groupMessages") { (inboxId: String, id: String, limit: Int?, before: Double?, after: Double?, direction: String?, deliveryStatus: String?) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			
			let beforeDate = before != nil ? Date(timeIntervalSince1970: TimeInterval(before!) / 1000) : nil
			let afterDate = after != nil ? Date(timeIntervalSince1970: TimeInterval(after!) / 1000) : nil

			let sortDirection: Int = (direction != nil && direction == "SORT_DIRECTION_ASCENDING") ? 1 : 2
			
			let status: String = (deliveryStatus != nil) ? deliveryStatus!.lowercased() : "all"

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			let decryptedMessages = try await group.decryptedMessages(
				before: beforeDate,
				after: afterDate,
				limit: limit,
				direction: PagingInfoSortDirection(rawValue: sortDirection),
				deliveryStatus: MessageDeliveryStatus(rawValue: status)
			)
			
			return decryptedMessages.compactMap { msg in
				do {
					return try DecodedMessageWrapper.encode(msg, client: client)
				} catch {
					print("discarding message, unable to encode wrapper \(msg.id)")
					return nil
				}
			}
		}
		
		AsyncFunction("findV3Message") { (inboxId: String, messageId: String) -> String? in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			if let message = try client.findMessage(messageId: messageId) {
				return try DecodedMessageWrapper.encode(message.decrypt(), client: client)
			} else {
				return nil
			}
		}

		AsyncFunction("findGroup") { (inboxId: String, groupId: String) -> String? in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			if let group = try client.findGroup(groupId: groupId) {
				return try GroupWrapper.encode(group, client: client)
			} else {
				return nil
			}
		}


		AsyncFunction("loadBatchMessages") { (inboxId: String, topics: [String]) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			var topicsList: [String: Pagination?] = [:]
			topics.forEach { topicJSON in
				let jsonData = topicJSON.data(using: .utf8)!
				guard let jsonObj = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
				      let topic = jsonObj["topic"] as? String
				else {
					return // Skip this topic if it doesn't have valid JSON data or missing "topic" field
				}

				var limit: Int?
				var before: Double?
				var after: Double?
				var direction: PagingInfoSortDirection = .descending

				if let limitInt = jsonObj["limit"] as? Int {
					limit = limitInt
				}

				if let beforeInt = jsonObj["before"] as? Double {
					before = TimeInterval(beforeInt / 1000)
				}

				if let afterInt = jsonObj["after"] as? Double {
					after = TimeInterval(afterInt / 1000)
				}

				if let directionStr = jsonObj["direction"] as? String {
					let sortDirection: Int = (directionStr == "SORT_DIRECTION_ASCENDING") ? 1 : 2
					direction = PagingInfoSortDirection(rawValue: sortDirection) ?? .descending
				}

				let page = Pagination(
					limit: limit ?? nil,
					before: before != nil && before! > 0 ? Date(timeIntervalSince1970: before!) : nil,
					after: after != nil && after! > 0 ? Date(timeIntervalSince1970: after!) : nil,
					direction: direction
				)

				topicsList[topic] = page
			}

			let decodedMessages = try await client.conversations.listBatchDecryptedMessages(topics: topicsList)

			return decodedMessages.compactMap { msg in
				do {
					return try DecodedMessageWrapper.encode(msg, client: client)
				} catch {
					print("discarding message, unable to encode wrapper \(msg.id)")
					return nil
				}
			}
		}

		AsyncFunction("sendMessage") { (inboxId: String, conversationTopic: String, contentJson: String) -> String in
			guard let conversation = try await findConversation(inboxId: inboxId, topic: conversationTopic) else {
				throw Error.conversationNotFound("no conversation found for \(conversationTopic)")
			}

			let sending = try ContentJson.fromJson(contentJson)
			return try await conversation.send(
				content: sending.content,
				options: SendOptions(contentType: sending.type)
			)
		}
		
		AsyncFunction("sendMessageToGroup") { (inboxId: String, id: String, contentJson: String) -> String in
			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}

			let sending = try ContentJson.fromJson(contentJson)
			return try await group.send(
				content: sending.content,
				options: SendOptions(contentType: sending.type)
			)
		}

		AsyncFunction("prepareMessage") { (
			inboxId: String,
			conversationTopic: String,
			contentJson: String
		) -> String in
			guard let conversation = try await findConversation(inboxId: inboxId, topic: conversationTopic) else {
				throw Error.conversationNotFound("no conversation found for \(conversationTopic)")
			}
			let sending = try ContentJson.fromJson(contentJson)
			let prepared = try await conversation.prepareMessage(
				content: sending.content,
				options: SendOptions(contentType: sending.type)
			)
			let preparedAtMillis = prepared.envelopes[0].timestampNs / 1_000_000
			let preparedData = try prepared.serializedData()
			let preparedFile = FileManager.default.temporaryDirectory.appendingPathComponent(prepared.messageID)
			try preparedData.write(to: preparedFile)
			return try PreparedLocalMessage(
				messageId: prepared.messageID,
				preparedFileUri: preparedFile.absoluteString,
				preparedAt: preparedAtMillis
			).toJson()
		}

		AsyncFunction("prepareEncodedMessage") { (
			inboxId: String,
			conversationTopic: String,
			encodedContentData: [UInt8]
		) -> String in
			guard let conversation = try await findConversation(inboxId: inboxId, topic: conversationTopic) else {
				throw Error.conversationNotFound("no conversation found for \(conversationTopic)")
			}
            let encodedContent = try EncodedContent(serializedData: Data(encodedContentData))

			let prepared = try await conversation.prepareMessage(
				encodedContent: encodedContent
			)
			let preparedAtMillis = prepared.envelopes[0].timestampNs / 1_000_000
			let preparedData = try prepared.serializedData()
			let preparedFile = FileManager.default.temporaryDirectory.appendingPathComponent(prepared.messageID)
			try preparedData.write(to: preparedFile)
			return try PreparedLocalMessage(
				messageId: prepared.messageID,
				preparedFileUri: preparedFile.absoluteString,
				preparedAt: preparedAtMillis
			).toJson()
		}

		AsyncFunction("sendPreparedMessage") { (inboxId: String, preparedLocalMessageJson: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			guard let local = try? PreparedLocalMessage.fromJson(preparedLocalMessageJson) else {
				throw Error.badPreparation("bad prepared local message")
			}
			guard let preparedFileUrl = URL(string: local.preparedFileUri) else {
				throw Error.badPreparation("bad prepared local message URI \(local.preparedFileUri)")
			}
			guard let preparedData = try? Data(contentsOf: preparedFileUrl) else {
				throw Error.badPreparation("unable to load local message file")
			}
			guard let prepared = try? PreparedMessage.fromSerializedData(preparedData) else {
				throw Error.badPreparation("unable to deserialized \(local.preparedFileUri)")
			}
			try await client.publish(envelopes: prepared.envelopes)
			do {
				try FileManager.default.removeItem(at: URL(string: local.preparedFileUri)!)
			} catch { /* ignore: the sending succeeds even if we fail to rm the tmp file afterward */ }
			return prepared.messageID
		}

    AsyncFunction("createConversation") { (inboxId: String, peerAddress: String, contextJson: String, consentProofBytes: [UInt8]) -> String in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			do {
				let contextData = contextJson.data(using: .utf8)!
				let contextObj = (try? JSONSerialization.jsonObject(with: contextData) as? [String: Any]) ?? [:]
                var consentProofData:ConsentProofPayload?
                if consentProofBytes.count != 0 {
                    do {
                        consentProofData = try ConsentProofPayload(serializedData: Data(consentProofBytes))
                    }  catch {
                        print("Error: \(error)")
                    }
                }
				let conversation = try await client.conversations.newConversation(
                    with: peerAddress,
                    context: .init(
                        conversationID: contextObj["conversationID"] as? String ?? "",
                        metadata: contextObj["metadata"] as? [String: String] ?? [:] as [String: String]
                    ),
                    consentProofPayload:consentProofData
                )

				return try ConversationWrapper.encode(conversation, client: client)
			} catch {
				print("ERRRO!: \(error.localizedDescription)")
				throw error
			}
		}
		
		AsyncFunction("createGroup") { (inboxId: String, peerAddresses: [String], permission: String, groupOptionsJson: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId) else {
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
				let createGroupParams = CreateGroupParamsWrapper.createGroupParamsFromJson(groupOptionsJson)
				let group = try await client.conversations.newGroup(
					with: peerAddresses, 
					permissions: permissionLevel, 
					name: createGroupParams.groupName, 
					imageUrlSquare: createGroupParams.groupImageUrlSquare, 
					description: createGroupParams.groupDescription, 
					pinnedFrameUrl: createGroupParams.groupPinnedFrameUrl
				)
				return try GroupWrapper.encode(group, client: client)
			} catch {
				print("ERRRO!: \(error.localizedDescription)")
				throw error
			}
		}
		
		AsyncFunction("listMemberInboxIds") { (inboxId: String, groupId: String) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: groupId) else {
				throw Error.conversationNotFound("no group found for \(groupId)")
			}
			return try group.members.map(\.inboxId)
		}
		
		AsyncFunction("listGroupMembers") { (inboxId: String, groupId: String) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: groupId) else {
				throw Error.conversationNotFound("no group found for \(groupId)")
			}
			return try group.members.compactMap { member in
				return try MemberWrapper.encode(member)
			}
		}
		
		
		AsyncFunction("syncGroups") { (inboxId: String) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			try await client.conversations.sync()
		}

		AsyncFunction("syncGroup") { (inboxId: String, id: String) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			try await group.sync()
		}

		AsyncFunction("addGroupMembers") { (inboxId: String, id: String, peerAddresses: [String]) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			try await group.addMembers(addresses: peerAddresses)
		}

		AsyncFunction("removeGroupMembers") { (inboxId: String, id: String, peerAddresses: [String]) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}

			try await group.removeMembers(addresses: peerAddresses)
		}
		
		AsyncFunction("addGroupMembersByInboxId") { (inboxId: String, id: String, inboxIds: [String]) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			try await group.addMembersByInboxId(inboxIds: inboxIds)
		}

		AsyncFunction("removeGroupMembersByInboxId") { (inboxId: String, id: String, inboxIds: [String]) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}

			try await group.removeMembersByInboxId(inboxIds: inboxIds)
		}

		AsyncFunction("groupName") { (inboxId: String, id: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}

			return try group.groupName()
		}

		AsyncFunction("updateGroupName") { (inboxId: String, id: String, groupName: String) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}

			try await group.updateGroupName(groupName: groupName)
		}
		
		AsyncFunction("groupImageUrlSquare") { (inboxId: String, id: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}

			return try group.groupImageUrlSquare()
		}

		AsyncFunction("updateGroupImageUrlSquare") { (inboxId: String, id: String, groupImageUrl: String) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}

			try await group.updateGroupImageUrlSquare(imageUrlSquare: groupImageUrl)
		}
		
		AsyncFunction("groupDescription") { (inboxId: String, id: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}

			return try group.groupDescription()
		}

		AsyncFunction("updateGroupDescription") { (inboxId: String, id: String, description: String) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}

			try await group.updateGroupDescription(groupDescription: description)
		}

		AsyncFunction("groupPinnedFrameUrl") { (inboxId: String, id: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}

			return try group.groupPinnedFrameUrl()
		}

		AsyncFunction("updateGroupPinnedFrameUrl") { (inboxId: String, id: String, pinnedFrameUrl: String) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}

			try await group.updateGroupPinnedFrameUrl(groupPinnedFrameUrl: pinnedFrameUrl)
		}
		
		AsyncFunction("isGroupActive") { (inboxId: String, id: String) -> Bool in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			
			return try group.isActive()
		}

		AsyncFunction("addedByInboxId") { (inboxId: String, id: String) -> String in
			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			
			return try group.addedByInboxId()
		}

		AsyncFunction("creatorInboxId") { (inboxId: String, id: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			
			return try group.creatorInboxId()
		}

		AsyncFunction("isAdmin") { (clientInboxId: String, id: String, inboxId: String) -> Bool in
			guard let client = await clientsManager.getClient(key: clientInboxId) else {
				throw Error.noClient
			}
			guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			return try group.isAdmin(inboxId: inboxId)
		}

		AsyncFunction("isSuperAdmin") { (clientInboxId: String, id: String, inboxId: String) -> Bool in
			guard let client = await clientsManager.getClient(key: clientInboxId) else {
				throw Error.noClient
			}
			guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			return try group.isSuperAdmin(inboxId: inboxId)
		}

		AsyncFunction("listAdmins") { (inboxId: String, id: String) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			return try group.listAdmins()
		}

		AsyncFunction("listSuperAdmins") { (inboxId: String, id: String) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			return try group.listSuperAdmins()
		}

		AsyncFunction("addAdmin") { (clientInboxId: String, id: String, inboxId: String) in
			guard let client = await clientsManager.getClient(key: clientInboxId) else {
				throw Error.noClient
			}
			guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			try await group.addAdmin(inboxId: inboxId)
		}

		AsyncFunction("addSuperAdmin") { (clientInboxId: String, id: String, inboxId: String) in
			guard let client = await clientsManager.getClient(key: clientInboxId) else {
				throw Error.noClient
			}
			guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			try await group.addSuperAdmin(inboxId: inboxId)
		}

		AsyncFunction("removeAdmin") { (clientInboxId: String, id: String, inboxId: String) in
			guard let client = await clientsManager.getClient(key: clientInboxId) else {
				throw Error.noClient
			}
			guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			try await group.removeAdmin(inboxId: inboxId)
		}

		AsyncFunction("removeSuperAdmin") { (clientInboxId: String, id: String, inboxId: String) in
			guard let client = await clientsManager.getClient(key: clientInboxId) else {
				throw Error.noClient
			}
			guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			try await group.removeSuperAdmin(inboxId: inboxId)
		}
        
        AsyncFunction("updateAddMemberPermission") { (clientInboxId: String, id: String, newPermission: String) in
            guard let client = await clientsManager.getClient(key: clientInboxId) else {
                throw Error.noClient
            }
            guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
                throw Error.conversationNotFound("no group found for \(id)")
            }
            try await group.updateAddMemberPermission(newPermissionOption: getPermissionOption(permission: newPermission))
        }

        AsyncFunction("updateRemoveMemberPermission") { (clientInboxId: String, id: String, newPermission: String) in
            guard let client = await clientsManager.getClient(key: clientInboxId) else {
                throw Error.noClient
            }
            guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
                throw Error.conversationNotFound("no group found for \(id)")
            }
            try await group.updateRemoveMemberPermission(newPermissionOption: getPermissionOption(permission: newPermission))
        }

        AsyncFunction("updateAddAdminPermission") { (clientInboxId: String, id: String, newPermission: String) in
            guard let client = await clientsManager.getClient(key: clientInboxId) else {
                throw Error.noClient
            }
            guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
                throw Error.conversationNotFound("no group found for \(id)")
            }
            try await group.updateAddAdminPermission(newPermissionOption: getPermissionOption(permission: newPermission))
        }

        AsyncFunction("updateRemoveAdminPermission") { (clientInboxId: String, id: String, newPermission: String) in
            guard let client = await clientsManager.getClient(key: clientInboxId) else {
                throw Error.noClient
            }
            guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
                throw Error.conversationNotFound("no group found for \(id)")
            }
            try await group.updateRemoveAdminPermission(newPermissionOption: getPermissionOption(permission: newPermission))
        }

        AsyncFunction("updateGroupNamePermission") { (clientInboxId: String, id: String, newPermission: String) in
            guard let client = await clientsManager.getClient(key: clientInboxId) else {
                throw Error.noClient
            }
            guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
                throw Error.conversationNotFound("no group found for \(id)")
            }
            try await group.updateGroupNamePermission(newPermissionOption: getPermissionOption(permission: newPermission))
        }

        AsyncFunction("updateGroupImageUrlSquarePermission") { (clientInboxId: String, id: String, newPermission: String) in
            guard let client = await clientsManager.getClient(key: clientInboxId) else {
                throw Error.noClient
            }
            guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
                throw Error.conversationNotFound("no group found for \(id)")
            }
            try await group.updateGroupImageUrlSquarePermission(newPermissionOption: getPermissionOption(permission: newPermission))
        }

        AsyncFunction("updateGroupDescriptionPermission") { (clientInboxId: String, id: String, newPermission: String) in
            guard let client = await clientsManager.getClient(key: clientInboxId) else {
                throw Error.noClient
            }
            guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
                throw Error.conversationNotFound("no group found for \(id)")
            }
            try await group.updateGroupDescriptionPermission(newPermissionOption: getPermissionOption(permission: newPermission))
        }

		AsyncFunction("updateGroupPinnedFrameUrlPermission") { (clientInboxId: String, id: String, newPermission: String) in
            guard let client = await clientsManager.getClient(key: clientInboxId) else {
                throw Error.noClient
            }
            guard let group = try await findGroup(inboxId: clientInboxId, id: id) else {
                throw Error.conversationNotFound("no group found for \(id)")
            }
            try await group.updateGroupPinnedFrameUrlPermission(newPermissionOption: getPermissionOption(permission: newPermission))
        }
        
        AsyncFunction("permissionPolicySet") { (inboxId: String, id: String) async throws -> String in
            
            guard let client = await clientsManager.getClient(key: inboxId) else {
                throw Error.noClient
            }
            
            guard let group = try await findGroup(inboxId: inboxId, id: id) else {
                throw Error.conversationNotFound("Permission policy set not found for group: \(id)")
            }
            
            let permissionPolicySet = try group.permissionPolicySet()
            
            return try PermissionPolicySetWrapper.encodeToJsonString(permissionPolicySet)
        }
        
        
        
        AsyncFunction("processGroupMessage") { (inboxId: String, id: String, encryptedMessage: String) -> String in
            guard let client = await clientsManager.getClient(key: inboxId) else {
                throw Error.noClient
            }
            
            guard let group = try await findGroup(inboxId: inboxId, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			
			guard let encryptedMessageData = Data(base64Encoded: Data(encryptedMessage.utf8)) else {
				throw Error.noMessage
			}
			let decodedMessage = try await group.processMessageDecrypted(envelopeBytes: encryptedMessageData)
			return try DecodedMessageWrapper.encode(decodedMessage, client: client)
		}

		AsyncFunction("processWelcomeMessage") { (inboxId: String, encryptedMessage: String) -> String in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			guard let encryptedMessageData = Data(base64Encoded: Data(encryptedMessage.utf8)) else {
				throw Error.noMessage
			}
			guard let group = try await client.conversations.fromWelcome(envelopeBytes: encryptedMessageData) else {
				throw Error.conversationNotFound("no group found")
			}

			return try GroupWrapper.encode(group, client: client)
		}

		AsyncFunction("subscribeToConversations") { (inboxId: String) in
			try await subscribeToConversations(inboxId: inboxId)
		}

		AsyncFunction("subscribeToAllMessages") { (inboxId: String, includeGroups: Bool) in
			try await subscribeToAllMessages(inboxId: inboxId, includeGroups: includeGroups)
		}
		
		AsyncFunction("subscribeToAllGroupMessages") { (inboxId: String) in
			try await subscribeToAllGroupMessages(inboxId: inboxId)
		}

		AsyncFunction("subscribeToMessages") { (inboxId: String, topic: String) in
			try await subscribeToMessages(inboxId: inboxId, topic: topic)
		}
		
		AsyncFunction("subscribeToGroups") { (inboxId: String) in
			try await subscribeToGroups(inboxId: inboxId)
		}
		
		AsyncFunction("subscribeToAll") { (inboxId: String) in
			try await subscribeToAll(inboxId: inboxId)
		}

		AsyncFunction("subscribeToGroupMessages") { (inboxId: String, id: String) in
			try await subscribeToGroupMessages(inboxId: inboxId, id: id)
		}

		AsyncFunction("unsubscribeFromConversations") { (inboxId: String) in
			await subscriptionsManager.get(getConversationsKey(inboxId: inboxId))?.cancel()
		}

		AsyncFunction("unsubscribeFromAllMessages") { (inboxId: String) in
			await subscriptionsManager.get(getMessagesKey(inboxId: inboxId))?.cancel()
		}
		
		AsyncFunction("unsubscribeFromAllGroupMessages") { (inboxId: String) in
			await subscriptionsManager.get(getGroupMessagesKey(inboxId: inboxId))?.cancel()
		}


		AsyncFunction("unsubscribeFromMessages") { (inboxId: String, topic: String) in
			try await unsubscribeFromMessages(inboxId: inboxId, topic: topic)
		}
		
		AsyncFunction("unsubscribeFromGroupMessages") { (inboxId: String, id: String) in
			try await unsubscribeFromGroupMessages(inboxId: inboxId, id: id)
		}
		
		AsyncFunction("unsubscribeFromGroups") { (inboxId: String) in
			await subscriptionsManager.get(getGroupsKey(inboxId: inboxId))?.cancel()
	   }

		AsyncFunction("registerPushToken") { (pushServer: String, token: String) in
			XMTPPush.shared.setPushServer(pushServer)
			do {
				try await XMTPPush.shared.register(token: token)
			} catch {
				print("Error registering: \(error)")
			}
		}

		AsyncFunction("subscribePushTopics") { (inboxId: String, topics: [String]) in
			do {
				guard let client = await clientsManager.getClient(key: inboxId) else {
					throw Error.noClient
				}
				let hmacKeysResult = await client.conversations.getHmacKeys()
				let subscriptions = topics.map { topic -> NotificationSubscription in
					let hmacKeys = hmacKeysResult.hmacKeys

					let result = hmacKeys[topic]?.values.map { hmacKey -> NotificationSubscriptionHmacKey in
						NotificationSubscriptionHmacKey.with { sub_key in
							sub_key.key = hmacKey.hmacKey
							sub_key.thirtyDayPeriodsSinceEpoch = UInt32(hmacKey.thirtyDayPeriodsSinceEpoch)
						}
					}

					return NotificationSubscription.with { sub in
						sub.hmacKeys = result ?? []
						sub.topic = topic
					}
				}

				try await XMTPPush.shared.subscribeWithMetadata(subscriptions: subscriptions)
			} catch {
				print("Error subscribing: \(error)")
			}
		}

		AsyncFunction("decodeMessage") { (inboxId: String, topic: String, encryptedMessage: String) -> String in
			guard let encryptedMessageData = Data(base64Encoded: Data(encryptedMessage.utf8)) else {
				throw Error.noMessage
			}

			let envelope = XMTP.Envelope.with { envelope in
				envelope.message = encryptedMessageData
				envelope.contentTopic = topic
			}

			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}

			guard let conversation = try await findConversation(inboxId: inboxId, topic: topic) else {
				throw Error.conversationNotFound("no conversation found for \(topic)")
			}
			let decodedMessage = try conversation.decrypt(envelope)
			return try DecodedMessageWrapper.encode(decodedMessage, client: client)
		}

		AsyncFunction("isAllowed") { (inboxId: String, address: String) -> Bool in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			return await client.contacts.isAllowed(address)
		}

		AsyncFunction("isDenied") { (inboxId: String, address: String) -> Bool in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			return await client.contacts.isDenied(address)
		}

		AsyncFunction("denyContacts") { (inboxId: String, addresses: [String]) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			try await client.contacts.deny(addresses: addresses)
		}

		AsyncFunction("allowContacts") { (inboxId: String, addresses: [String]) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			try await client.contacts.allow(addresses: addresses)
		}
		
		AsyncFunction("isInboxAllowed") { (clientInboxId: String, inboxId: String) -> Bool in
			guard let client = await clientsManager.getClient(key: clientInboxId) else {
				throw Error.noClient
			}
			return await client.contacts.isInboxAllowed(inboxId: inboxId)
		}

		AsyncFunction("isInboxDenied") { (clientInboxId: String,inboxId: String) -> Bool in
			guard let client = await clientsManager.getClient(key: clientInboxId) else {
				throw Error.noClient
			}
			return await client.contacts.isInboxDenied(inboxId: inboxId)
		}

		AsyncFunction("denyInboxes") { (inboxId: String, inboxIds: [String]) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			try await client.contacts.denyInboxes(inboxIds: inboxIds)
		}

		AsyncFunction("allowInboxes") { (inboxId: String, inboxIds: [String]) in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			try await client.contacts.allowInboxes(inboxIds: inboxIds)
		}

		AsyncFunction("refreshConsentList") { (inboxId: String) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			let consentList = try await client.contacts.refreshConsentList()

			return try await consentList.entriesManager.map.compactMap { entry in
				try ConsentWrapper.encode(entry.value)
			}
		}

		AsyncFunction("conversationConsentState") { (inboxId: String, conversationTopic: String) -> String in
			guard let conversation = try await findConversation(inboxId: inboxId, topic: conversationTopic) else {
				throw Error.conversationNotFound(conversationTopic)
			}
			return try ConsentWrapper.consentStateToString(state: await conversation.consentState())
		}
		
		AsyncFunction("groupConsentState") { (inboxId: String, groupId: String) -> String in
			guard let group = try await findGroup(inboxId: inboxId, id: groupId) else {
				throw Error.conversationNotFound("no group found for \(groupId)")
			}
			return try ConsentWrapper.consentStateToString(state: await XMTP.Conversation.group(group).consentState())
		}

		AsyncFunction("consentList") { (inboxId: String) -> [String] in
			guard let client = await clientsManager.getClient(key: inboxId) else {
				throw Error.noClient
			}
			let entries = await client.contacts.consentList.entriesManager.map

			return try entries.compactMap { entry in
				try ConsentWrapper.encode(entry.value)
			}
		}
		
		Function("preEnableIdentityCallbackCompleted") {
			DispatchQueue.global().async {
				self.preEnableIdentityCallbackDeferred?.signal()
				self.preEnableIdentityCallbackDeferred = nil
			}
		}
		
		Function("preCreateIdentityCallbackCompleted") {
			DispatchQueue.global().async {
				self.preCreateIdentityCallbackDeferred?.signal()
				self.preCreateIdentityCallbackDeferred = nil
			}
		}
    
    AsyncFunction("allowGroups") { (inboxId: String, groupIds: [String]) in
      guard let client = await clientsManager.getClient(key: inboxId) else {
        throw Error.noClient
      }
      try await client.contacts.allowGroups(groupIds: groupIds)
    }
    
    AsyncFunction("denyGroups") { (inboxId: String, groupIds: [String]) in
      guard let client = await clientsManager.getClient(key: inboxId) else {
        throw Error.noClient
      }
      try await client.contacts.denyGroups(groupIds: groupIds)
    }

    AsyncFunction("isGroupAllowed") { (inboxId: String, groupId: String) -> Bool in
      guard let client = await clientsManager.getClient(key: inboxId) else {
        throw Error.noClient
      }
      guard let groupDataId = Data(hex: groupId) else {
        throw Error.invalidString
      }
      return await client.contacts.isGroupAllowed(groupId: groupDataId)
    }
    
    AsyncFunction("isGroupDenied") { (inboxId: String, groupId: String) -> Bool in
      guard let client = await clientsManager.getClient(key: inboxId) else {
        throw Error.invalidString
      }
      guard let groupDataId = Data(hex: groupId) else {
        throw Error.invalidString
      }
      return await client.contacts.isGroupDenied(groupId: groupDataId)
		}
	}

	//
	// Helpers
	//
    
    private func getPermissionOption(permission: String) async throws -> PermissionOption {
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

	func createClientConfig(env: String, appVersion: String?, preEnableIdentityCallback: PreEventCallback? = nil, preCreateIdentityCallback: PreEventCallback? = nil, enableV3: Bool = false, dbEncryptionKey: Data? = nil, dbDirectory: String? = nil, historySyncUrl: String? = nil) -> XMTP.ClientOptions {
		// Ensure that all codecs have been registered.
		switch env {
		case "local":
			return XMTP.ClientOptions(api: XMTP.ClientOptions.Api(
				env: XMTP.XMTPEnvironment.local,
				isSecure: false,
				appVersion: appVersion
			), preEnableIdentityCallback: preEnableIdentityCallback, preCreateIdentityCallback: preCreateIdentityCallback, enableV3: enableV3, encryptionKey: dbEncryptionKey, dbDirectory: dbDirectory, historySyncUrl: historySyncUrl)
		case "production":
			return XMTP.ClientOptions(api: XMTP.ClientOptions.Api(
				env: XMTP.XMTPEnvironment.production,
				isSecure: true,
				appVersion: appVersion
			), preEnableIdentityCallback: preEnableIdentityCallback, preCreateIdentityCallback: preCreateIdentityCallback, enableV3: enableV3, encryptionKey: dbEncryptionKey, dbDirectory: dbDirectory, historySyncUrl: historySyncUrl)
		default:
			return XMTP.ClientOptions(api: XMTP.ClientOptions.Api(
				env: XMTP.XMTPEnvironment.dev,
				isSecure: true,
				appVersion: appVersion
			), preEnableIdentityCallback: preEnableIdentityCallback, preCreateIdentityCallback: preCreateIdentityCallback, enableV3: enableV3, encryptionKey: dbEncryptionKey, dbDirectory: dbDirectory, historySyncUrl: historySyncUrl)
		}
	}

	func findConversation(inboxId: String, topic: String) async throws -> Conversation? {
		guard let client = await clientsManager.getClient(key: inboxId) else {
			throw Error.noClient
		}

		let cacheKey = Conversation.cacheKeyForTopic(inboxId: inboxId, topic: topic)
		if let conversation = await conversationsManager.get(cacheKey) {
			return conversation
		} else if let conversation = try await client.conversations.list().first(where: { $0.topic == topic }) {
			await conversationsManager.set(cacheKey, conversation)
			return conversation
		}

		return nil
	}
	
	func findGroup(inboxId: String, id: String) async throws -> XMTP.Group? {
		guard let client = await clientsManager.getClient(key: inboxId) else {
			throw Error.noClient
		}

		let cacheKey = XMTP.Group.cacheKeyForId(inboxId: client.inboxID, id: id)
		if let group = await groupsManager.get(cacheKey) {
			return group
		} else if let group = try client.findGroup(groupId: id) {
			await groupsManager.set(cacheKey, group)
			return group
		}

		return nil
	}


	func subscribeToConversations(inboxId: String) async throws {
		guard let client = await clientsManager.getClient(key: inboxId) else {
			return
		}

		await subscriptionsManager.get(getConversationsKey(inboxId: inboxId))?.cancel()
		await subscriptionsManager.set(getConversationsKey(inboxId: inboxId), Task {
			do {
				for try await conversation in try await client.conversations.stream() {
					try sendEvent("conversation", [
						"inboxId": inboxId,
						"conversation": ConversationWrapper.encodeToObj(conversation, client: client),
					])
				}
			} catch {
				print("Error in conversations subscription: \(error)")
				await subscriptionsManager.get(getConversationsKey(inboxId: inboxId))?.cancel()
			}
		})
	}

	func subscribeToAllMessages(inboxId: String, includeGroups: Bool = false) async throws {
		guard let client = await clientsManager.getClient(key: inboxId) else {
			return
		}

		await subscriptionsManager.get(getMessagesKey(inboxId: inboxId))?.cancel()
		await subscriptionsManager.set(getMessagesKey(inboxId: inboxId), Task {
			do {
				for try await message in await client.conversations.streamAllDecryptedMessages(includeGroups: includeGroups) {
					do {
						try sendEvent("message", [
							"inboxId": inboxId,
							"message": DecodedMessageWrapper.encodeToObj(message, client: client),
						])
					} catch {
						print("discarding message, unable to encode wrapper \(message.id)")
					}
				}
			} catch {
				print("Error in all messages subscription: \(error)")
				await subscriptionsManager.get(getMessagesKey(inboxId: inboxId))?.cancel()
			}
		})
	}
	
	func subscribeToAllGroupMessages(inboxId: String) async throws {
		guard let client = await clientsManager.getClient(key: inboxId) else {
			return
		}

		await subscriptionsManager.get(getGroupMessagesKey(inboxId: client.inboxID))?.cancel()
		await subscriptionsManager.set(getGroupMessagesKey(inboxId: client.inboxID), Task {
			do {
				for try await message in await client.conversations.streamAllGroupDecryptedMessages() {
					do {
            try sendEvent("allGroupMessage", [
							"inboxId": inboxId,
							"message": DecodedMessageWrapper.encodeToObj(message, client: client),
						])
					} catch {
						print("discarding message, unable to encode wrapper \(message.id)")
					}
				}
			} catch {
				print("Error in all messages subscription: \(error)")
				await subscriptionsManager.get(getMessagesKey(inboxId: inboxId))?.cancel()
			}
		})
	}

	func subscribeToMessages(inboxId: String, topic: String) async throws {
		guard let conversation = try await findConversation(inboxId: inboxId, topic: topic) else {
			return
		}

		guard let client = await clientsManager.getClient(key: inboxId) else {
			throw Error.noClient
		}

		await subscriptionsManager.get(conversation.cacheKey(inboxId))?.cancel()
		await subscriptionsManager.set(conversation.cacheKey(inboxId), Task {
			do {
				for try await message in conversation.streamDecryptedMessages() {
					do {
						try sendEvent("conversationMessage", [
							"inboxId": inboxId,
							"message": DecodedMessageWrapper.encodeToObj(message, client: client),
              "topic": topic
						])
					} catch {
						print("discarding message, unable to encode wrapper \(message.id)")
					}
				}
			} catch {
				print("Error in messages subscription: \(error)")
				await subscriptionsManager.get(conversation.cacheKey(inboxId))?.cancel()
			}
		})
	}
	
	func subscribeToGroups(inboxId: String) async throws {
		guard let client = await clientsManager.getClient(key: inboxId) else {
			return
		}
		await subscriptionsManager.get(getGroupsKey(inboxId: client.inboxID))?.cancel()
		await subscriptionsManager.set(getGroupsKey(inboxId: client.inboxID), Task {
			do {
				for try await group in try await client.conversations.streamGroups() {
					try sendEvent("group", [
						"inboxId": inboxId,
						"group": GroupWrapper.encodeToObj(group, client: client),
					])
				}
			} catch {
				print("Error in groups subscription: \(error)")
				await subscriptionsManager.get(getGroupsKey(inboxId: client.inboxID))?.cancel()
			}
		})
	}
	
	func subscribeToAll(inboxId: String) async throws {
		guard let client = await clientsManager.getClient(key: inboxId) else {
			return
		}

		await subscriptionsManager.get(getConversationsKey(inboxId: inboxId))?.cancel()
		await subscriptionsManager.set(getConversationsKey(inboxId: inboxId), Task {
			do {
				for try await conversation in await client.conversations.streamAll() {
					try sendEvent("conversationContainer", [
						"inboxId": inboxId,
						"conversationContainer": ConversationContainerWrapper.encodeToObj(conversation, client: client),
					])
				}
			} catch {
				print("Error in all conversations subscription: \(error)")
				await subscriptionsManager.get(getConversationsKey(inboxId: inboxId))?.cancel()
			}
		})
	}
	
	func subscribeToGroupMessages(inboxId: String, id: String) async throws {
		guard let group = try await findGroup(inboxId: inboxId, id: id) else {
			return
		}

		guard let client = await clientsManager.getClient(key: inboxId) else {
			throw Error.noClient
		}

		await subscriptionsManager.get(group.cacheKey(client.inboxID))?.cancel()
		await subscriptionsManager.set(group.cacheKey(client.inboxID), Task {
			do {
				for try await message in group.streamDecryptedMessages() {
					do {
						try sendEvent("groupMessage", [
							"inboxId": inboxId,
							"message": DecodedMessageWrapper.encodeToObj(message, client: client),
              "groupId": id,
						])
					} catch {
						print("discarding message, unable to encode wrapper \(message.id)")
					}
				}
			} catch {
				print("Error in group messages subscription: \(error)")
				await subscriptionsManager.get(group.cacheKey(inboxId))?.cancel()
			}
		})
	}
	

	func unsubscribeFromMessages(inboxId: String, topic: String) async throws {
		guard let conversation = try await findConversation(inboxId: inboxId, topic: topic) else {
			return
		}

		await subscriptionsManager.get(conversation.cacheKey(inboxId))?.cancel()
	}
	
	func unsubscribeFromGroupMessages(inboxId: String, id: String) async throws {
		guard let group = try await findGroup(inboxId: inboxId, id: id) else {
			return
		}

		await subscriptionsManager.get(group.cacheKey(inboxId))?.cancel()
	}

	func getMessagesKey(inboxId: String) -> String {
		return "messages:\(inboxId)"
	}
	
	func getGroupMessagesKey(inboxId: String) -> String {
		return "groupMessages:\(inboxId)"
	}

	func getConversationsKey(inboxId: String) -> String {
		return "conversations:\(inboxId)"
	}
	
	func getGroupsKey(inboxId: String) -> String {
		return "groups:\(inboxId)"
	}

	func preEnableIdentityCallback() {
		sendEvent("preEnableIdentityCallback")
		self.preEnableIdentityCallbackDeferred?.wait()
	}

	func preCreateIdentityCallback() {
		sendEvent("preCreateIdentityCallback")
		self.preCreateIdentityCallbackDeferred?.wait()
	}
}
