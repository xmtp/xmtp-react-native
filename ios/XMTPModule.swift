import ExpoModulesCore
import XMTP

extension Conversation {
	static func cacheKeyForTopic(clientAddress: String, topic: String) -> String {
		return "\(clientAddress):\(topic)"
	}

	func cacheKey(_ clientAddress: String) -> String {
		return Conversation.cacheKeyForTopic(clientAddress: clientAddress, topic: topic)
	}
}

extension XMTP.Group {
	static func cacheKeyForId(clientAddress: String, id: String) -> String {
		return "\(clientAddress):\(id)"
	}
	
	func cacheKey(_ clientAddress: String) -> String {
		return XMTP.Group.cacheKeyForId(clientAddress: clientAddress, id: id.toHex)
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
		case noClient, conversationNotFound(String), noMessage, invalidKeyBundle, invalidDigest, badPreparation(String), mlsNotEnabled(String)
	}

	public func definition() -> ModuleDefinition {
		Name("XMTP")

		Events("sign", "authed", "conversation", "message", "group", "conversationContainer", "preEnableIdentityCallback", "preCreateIdentityCallback")

		AsyncFunction("address") { (clientAddress: String) -> String in
			if let client = await clientsManager.getClient(key: clientAddress) {
				return client.address
			} else {
				return "No Client."
			}
		}

		//
		// Auth functions
		//
		AsyncFunction("auth") { (address: String, environment: String, appVersion: String?, hasCreateIdentityCallback: Bool?, hasEnableIdentityCallback: Bool?, enableAlphaMls: Bool?) in
			try requireNotProductionEnvForAlphaMLS(enableAlphaMls: enableAlphaMls, environment: environment)
			
			let signer = ReactNativeSigner(module: self, address: address)
			self.signer = signer
			if(hasCreateIdentityCallback ?? false) {
				preCreateIdentityCallbackDeferred = DispatchSemaphore(value: 0)
			}
			if(hasEnableIdentityCallback ?? false) {
				preEnableIdentityCallbackDeferred = DispatchSemaphore(value: 0)
			}
			let preCreateIdentityCallback: PreEventCallback? = hasCreateIdentityCallback ?? false ? self.preCreateIdentityCallback : nil
			let preEnableIdentityCallback: PreEventCallback? = hasEnableIdentityCallback ?? false ? self.preEnableIdentityCallback : nil
			let options = createClientConfig(env: environment, appVersion: appVersion, preEnableIdentityCallback: preEnableIdentityCallback, preCreateIdentityCallback: preCreateIdentityCallback, mlsAlpha: enableAlphaMls == true)
			try await clientsManager.updateClient(key: address, client: await XMTP.Client.create(account: signer, options: options))
			self.signer = nil
			sendEvent("authed")
		}

		Function("receiveSignature") { (requestID: String, signature: String) in
			try signer?.handle(id: requestID, signature: signature)
		}

		// Generate a random wallet and set the client to that
		AsyncFunction("createRandom") { (environment: String, appVersion: String?, hasCreateIdentityCallback: Bool?, hasEnableIdentityCallback: Bool?, enableAlphaMls: Bool?) -> String in
			try requireNotProductionEnvForAlphaMLS(enableAlphaMls: enableAlphaMls, environment: environment)

			let privateKey = try PrivateKey.generate()
			if(hasCreateIdentityCallback ?? false) {
				preCreateIdentityCallbackDeferred = DispatchSemaphore(value: 0)
			}
			if(hasEnableIdentityCallback ?? false) {
				preEnableIdentityCallbackDeferred = DispatchSemaphore(value: 0)
			}
			let preCreateIdentityCallback: PreEventCallback? = hasCreateIdentityCallback ?? false ? self.preCreateIdentityCallback : nil
			let preEnableIdentityCallback: PreEventCallback? = hasEnableIdentityCallback ?? false ? self.preEnableIdentityCallback : nil

			let options = createClientConfig(env: environment, appVersion: appVersion, preEnableIdentityCallback: preEnableIdentityCallback, preCreateIdentityCallback: preCreateIdentityCallback, mlsAlpha: enableAlphaMls == true)
			let client = try await Client.create(account: privateKey, options: options)

			await clientsManager.updateClient(key: client.address, client: client)
			return client.address
		}

		// Create a client using its serialized key bundle.
		AsyncFunction("createFromKeyBundle") { (keyBundle: String, environment: String, appVersion: String?, enableAlphaMls: Bool?) -> String in
			try requireNotProductionEnvForAlphaMLS(enableAlphaMls: enableAlphaMls, environment: environment)

			do {
				guard let keyBundleData = Data(base64Encoded: keyBundle),
				      let bundle = try? PrivateKeyBundle(serializedData: keyBundleData)
				else {
					throw Error.invalidKeyBundle
				}

				let options = createClientConfig(env: environment, appVersion: appVersion, mlsAlpha: enableAlphaMls == true)
				let client = try await Client.from(bundle: bundle, options: options)
				await clientsManager.updateClient(key: client.address, client: client)
				return client.address
			} catch {
				print("ERRO! Failed to create client: \(error)")
				throw error
			}
		}

		// Export the client's serialized key bundle.
		AsyncFunction("exportKeyBundle") { (clientAddress: String) -> String in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}
			let bundle = try client.privateKeyBundle.serializedData().base64EncodedString()
			return bundle
		}

		// Export the conversation's serialized topic data.
		AsyncFunction("exportConversationTopicData") { (clientAddress: String, topic: String) -> String in
			guard let conversation = try await findConversation(clientAddress: clientAddress, topic: topic) else {
				throw Error.conversationNotFound(topic)
			}
			return try conversation.toTopicData().serializedData().base64EncodedString()
		}

		// Import a conversation from its serialized topic data.
		AsyncFunction("importConversationTopicData") { (clientAddress: String, topicData: String) -> String in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}
			let data = try Xmtp_KeystoreApi_V1_TopicMap.TopicData(
				serializedData: Data(base64Encoded: Data(topicData.utf8))!
			)
			let conversation = await client.conversations.importTopicData(data: data)
			await conversationsManager.set(conversation.cacheKey(clientAddress), conversation)
			return try ConversationWrapper.encode(conversation, client: client)
		}

		//
		// Client API
		AsyncFunction("canMessage") { (clientAddress: String, peerAddress: String) -> Bool in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}

			return try await client.canMessage(peerAddress)
		}

		AsyncFunction("staticCanMessage") { (peerAddress: String, environment: String, appVersion: String?) -> Bool in
			do {
				let options = createClientConfig(env: environment, appVersion: appVersion)
				return try await XMTP.Client.canMessage(peerAddress, options: options)
			} catch {
				throw Error.noClient
			}
		}

		AsyncFunction("encryptAttachment") { (clientAddress: String, fileJson: String) -> String in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
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

		AsyncFunction("decryptAttachment") { (clientAddress: String, encryptedFileJson: String) -> String in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
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

		AsyncFunction("sendEncodedContent") { (clientAddress: String, topic: String, encodedContentData: [UInt8]) -> String in
			guard let conversation = try await findConversation(clientAddress: clientAddress, topic: topic) else {
				throw Error.conversationNotFound("no conversation found for \(topic)")
			}

			let encodedContent = try EncodedContent(serializedData: Data(encodedContentData))

			return try await conversation.send(encodedContent: encodedContent)
		}

		AsyncFunction("listConversations") { (clientAddress: String) -> [String] in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}

			let conversations = try await client.conversations.list()

			return try await withThrowingTaskGroup(of: String.self) { group in
				for conversation in conversations {
					group.addTask {
						await self.conversationsManager.set(conversation.cacheKey(clientAddress), conversation)
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
		
		AsyncFunction("listGroups") { (clientAddress: String) -> [String] in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}
			let groupList = try await client.conversations.groups()
			return try await withThrowingTaskGroup(of: String.self) { taskGroup in
				for group in groupList {
					taskGroup.addTask {
						await self.groupsManager.set(group.cacheKey(clientAddress), group)
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

		AsyncFunction("loadMessages") { (clientAddress: String, topic: String, limit: Int?, before: Double?, after: Double?, direction: String?) -> [String] in
			let beforeDate = before != nil ? Date(timeIntervalSince1970: TimeInterval(before!) / 1000) : nil
			let afterDate = after != nil ? Date(timeIntervalSince1970: TimeInterval(after!) / 1000) : nil

			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}

			guard let conversation = try await findConversation(clientAddress: clientAddress, topic: topic) else {
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
		
		AsyncFunction("groupMessages") { (clientAddress: String, id: String) -> [String] in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(clientAddress: clientAddress, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			let decryptedMessages = try await group.decryptedMessages()
			
			return decryptedMessages.compactMap { msg in
				do {
					return try DecodedMessageWrapper.encode(msg, client: client)
				} catch {
					print("discarding message, unable to encode wrapper \(msg.id)")
					return nil
				}
			}
		}

		AsyncFunction("loadBatchMessages") { (clientAddress: String, topics: [String]) -> [String] in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
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

		AsyncFunction("sendMessage") { (clientAddress: String, conversationTopic: String, contentJson: String) -> String in
			guard let conversation = try await findConversation(clientAddress: clientAddress, topic: conversationTopic) else {
				throw Error.conversationNotFound("no conversation found for \(conversationTopic)")
			}

			let sending = try ContentJson.fromJson(contentJson)
			return try await conversation.send(
				content: sending.content,
				options: SendOptions(contentType: sending.type)
			)
		}
		
		AsyncFunction("sendMessageToGroup") { (clientAddress: String, id: String, contentJson: String) -> String in
			guard let group = try await findGroup(clientAddress: clientAddress, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}

			let sending = try ContentJson.fromJson(contentJson)
			return try await group.send(
				content: sending.content,
				options: SendOptions(contentType: sending.type)
			)
		}

		AsyncFunction("prepareMessage") { (
			clientAddress: String,
			conversationTopic: String,
			contentJson: String
		) -> String in
			guard let conversation = try await findConversation(clientAddress: clientAddress, topic: conversationTopic) else {
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
			clientAddress: String,
			conversationTopic: String,
			encodedContentData: [UInt8]
		) -> String in
			guard let conversation = try await findConversation(clientAddress: clientAddress, topic: conversationTopic) else {
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

		AsyncFunction("sendPreparedMessage") { (clientAddress: String, preparedLocalMessageJson: String) -> String in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
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

		AsyncFunction("createConversation") { (clientAddress: String, peerAddress: String, contextJson: String) -> String in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}

			do {
				let contextData = contextJson.data(using: .utf8)!
				let contextObj = (try? JSONSerialization.jsonObject(with: contextData) as? [String: Any]) ?? [:]
				let conversation = try await client.conversations.newConversation(with: peerAddress, context: .init(
					conversationID: contextObj["conversationID"] as? String ?? "",
					metadata: contextObj["metadata"] as? [String: String] ?? [:] as [String: String]
				))

				return try ConversationWrapper.encode(conversation, client: client)
			} catch {
				print("ERRRO!: \(error.localizedDescription)")
				throw error
			}
		}
		
		AsyncFunction("createGroup") { (clientAddress: String, peerAddresses: [String]) -> String in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}
			do {
				let group = try await client.conversations.newGroup(with: peerAddresses)
				return try GroupWrapper.encode(group, client: client)
			} catch {
				print("ERRRO!: \(error.localizedDescription)")
				throw error
			}
		}
		
		AsyncFunction("listMemberAddresses") { (clientAddress: String, groupId: String) -> [String] in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(clientAddress: clientAddress, id: groupId) else {
				throw Error.conversationNotFound("no group found for \(groupId)")
			}
			return group.memberAddresses
		}
		
		AsyncFunction("syncGroups") { (clientAddress: String) in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}
			try await client.conversations.sync()
		}

		AsyncFunction("syncGroup") { (clientAddress: String, id: String) in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(clientAddress: clientAddress, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			try await group.sync()
		}

		AsyncFunction("addGroupMembers") { (clientAddress: String, id: String, peerAddresses: [String]) in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(clientAddress: clientAddress, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			try await group.addMembers(addresses: peerAddresses)
		}

		AsyncFunction("removeGroupMembers") { (clientAddress: String, id: String, peerAddresses: [String]) in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}

			guard let group = try await findGroup(clientAddress: clientAddress, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}

			try await group.removeMembers(addresses: peerAddresses)
		}
		
		AsyncFunction("isGroupActive") { (clientAddress: String, id: String) -> Bool in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}
			guard let group = try await findGroup(clientAddress: clientAddress, id: id) else {
				throw Error.conversationNotFound("no group found for \(id)")
			}
			
			return try group.isActive()
		}

		AsyncFunction("subscribeToConversations") { (clientAddress: String) in
			try await subscribeToConversations(clientAddress: clientAddress)
		}

		AsyncFunction("subscribeToAllMessages") { (clientAddress: String) in
			try await subscribeToAllMessages(clientAddress: clientAddress)
		}

		AsyncFunction("subscribeToMessages") { (clientAddress: String, topic: String) in
			try await subscribeToMessages(clientAddress: clientAddress, topic: topic)
		}
		
		AsyncFunction("subscribeToGroups") { (clientAddress: String) in
			try await subscribeToGroups(clientAddress: clientAddress)
		}
		
		AsyncFunction("subscribeToAll") { (clientAddress: String) in
			try await subscribeToAll(clientAddress: clientAddress)
		}

		AsyncFunction("subscribeToGroupMessages") { (clientAddress: String, id: String) in
			try await subscribeToGroupMessages(clientAddress: clientAddress, id: id)
		}

		AsyncFunction("unsubscribeFromConversations") { (clientAddress: String) in
			await subscriptionsManager.get(getConversationsKey(clientAddress: clientAddress))?.cancel()
		}

		AsyncFunction("unsubscribeFromAllMessages") { (clientAddress: String) in
			await subscriptionsManager.get(getMessagesKey(clientAddress: clientAddress))?.cancel()
		}

		AsyncFunction("unsubscribeFromMessages") { (clientAddress: String, topic: String) in
			try await unsubscribeFromMessages(clientAddress: clientAddress, topic: topic)
		}
		
		AsyncFunction("unsubscribeFromGroupMessages") { (clientAddress: String, id: String) in
			try await unsubscribeFromGroupMessages(clientAddress: clientAddress, id: id)
		}
		
		AsyncFunction("unsubscribeFromGroups") { (clientAddress: String) in
			await subscriptionsManager.get(getGroupsKey(clientAddress: clientAddress))?.cancel()
	   }

		AsyncFunction("registerPushToken") { (pushServer: String, token: String) in
			XMTPPush.shared.setPushServer(pushServer)
			do {
				try await XMTPPush.shared.register(token: token)
			} catch {
				print("Error registering: \(error)")
			}
		}

		AsyncFunction("subscribePushTopics") { (topics: [String]) in
			do {
				try await XMTPPush.shared.subscribe(topics: topics)
			} catch {
				print("Error subscribing: \(error)")
			}
		}

		AsyncFunction("decodeMessage") { (clientAddress: String, topic: String, encryptedMessage: String) -> String in
			guard let encryptedMessageData = Data(base64Encoded: Data(encryptedMessage.utf8)) else {
				throw Error.noMessage
			}

			let envelope = XMTP.Envelope.with { envelope in
				envelope.message = encryptedMessageData
				envelope.contentTopic = topic
			}

			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}

			guard let conversation = try await findConversation(clientAddress: clientAddress, topic: topic) else {
				throw Error.conversationNotFound("no conversation found for \(topic)")
			}
			let decodedMessage = try conversation.decrypt(envelope)
			return try DecodedMessageWrapper.encode(decodedMessage, client: client)
		}

		AsyncFunction("isAllowed") { (clientAddress: String, address: String) -> Bool in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}
			return await client.contacts.isAllowed(address)
		}

		AsyncFunction("isDenied") { (clientAddress: String, address: String) -> Bool in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}
			return await client.contacts.isDenied(address)
		}

		AsyncFunction("denyContacts") { (clientAddress: String, addresses: [String]) in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}
			try await client.contacts.deny(addresses: addresses)
		}

		AsyncFunction("allowContacts") { (clientAddress: String, addresses: [String]) in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}
			try await client.contacts.allow(addresses: addresses)
		}

		AsyncFunction("refreshConsentList") { (clientAddress: String) -> [String] in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}
			let consentList = try await client.contacts.refreshConsentList()

			return try consentList.entries.compactMap { entry in
				try ConsentWrapper.encode(entry.value)
			}
		}

		AsyncFunction("conversationConsentState") { (clientAddress: String, conversationTopic: String) -> String in
			guard let conversation = try await findConversation(clientAddress: clientAddress, topic: conversationTopic) else {
				throw Error.conversationNotFound(conversationTopic)
			}
			return ConsentWrapper.consentStateToString(state: await conversation.consentState())
		}

		AsyncFunction("consentList") { (clientAddress: String) -> [String] in
			guard let client = await clientsManager.getClient(key: clientAddress) else {
				throw Error.noClient
			}
			let entries = await client.contacts.consentList.entries

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
	}

	//
	// Helpers
	//

	func createClientConfig(env: String, appVersion: String?, preEnableIdentityCallback: PreEventCallback? = nil, preCreateIdentityCallback: PreEventCallback? = nil, mlsAlpha: Bool = false) -> XMTP.ClientOptions {
		// Ensure that all codecs have been registered.
		switch env {
		case "local":
			return XMTP.ClientOptions(api: XMTP.ClientOptions.Api(
				env: XMTP.XMTPEnvironment.local,
				isSecure: false,
				appVersion: appVersion
			), preEnableIdentityCallback: preEnableIdentityCallback, preCreateIdentityCallback: preCreateIdentityCallback, mlsAlpha: mlsAlpha)
		case "production":
			return XMTP.ClientOptions(api: XMTP.ClientOptions.Api(
				env: XMTP.XMTPEnvironment.production,
				isSecure: true,
				appVersion: appVersion
			), preEnableIdentityCallback: preEnableIdentityCallback, preCreateIdentityCallback: preCreateIdentityCallback, mlsAlpha: false)
		default:
			return XMTP.ClientOptions(api: XMTP.ClientOptions.Api(
				env: XMTP.XMTPEnvironment.dev,
				isSecure: true,
				appVersion: appVersion
			), preEnableIdentityCallback: preEnableIdentityCallback, preCreateIdentityCallback: preCreateIdentityCallback, mlsAlpha: mlsAlpha)
		}
	}

	func findConversation(clientAddress: String, topic: String) async throws -> Conversation? {
		guard let client = await clientsManager.getClient(key: clientAddress) else {
			throw Error.noClient
		}

		let cacheKey = Conversation.cacheKeyForTopic(clientAddress: clientAddress, topic: topic)
		if let conversation = await conversationsManager.get(cacheKey) {
			return conversation
		} else if let conversation = try await client.conversations.list().first(where: { $0.topic == topic }) {
			await conversationsManager.set(cacheKey, conversation)
			return conversation
		}

		return nil
	}
	
	func findGroup(clientAddress: String, id: String) async throws -> XMTP.Group? {
		guard let client = await clientsManager.getClient(key: clientAddress) else {
			throw Error.noClient
		}

		let cacheKey = XMTP.Group.cacheKeyForId(clientAddress: clientAddress, id: id)
		if let group = await groupsManager.get(cacheKey) {
			return group
		} else if let group = try await client.conversations.groups().first(where: { $0.id.toHex == id }) {
			await groupsManager.set(cacheKey, group)
			return group
		}

		return nil
	}


	func subscribeToConversations(clientAddress: String) async throws {
		guard let client = await clientsManager.getClient(key: clientAddress) else {
			return
		}

		await subscriptionsManager.get(getConversationsKey(clientAddress: clientAddress))?.cancel()
		await subscriptionsManager.set(getConversationsKey(clientAddress: clientAddress), Task {
			do {
				for try await conversation in await client.conversations.stream() {
					try sendEvent("conversation", [
						"clientAddress": clientAddress,
						"conversation": ConversationWrapper.encodeToObj(conversation, client: client),
					])
				}
			} catch {
				print("Error in conversations subscription: \(error)")
				await subscriptionsManager.get(getConversationsKey(clientAddress: clientAddress))?.cancel()
			}
		})
	}

	func subscribeToAllMessages(clientAddress: String) async throws {
		guard let client = await clientsManager.getClient(key: clientAddress) else {
			return
		}

		await subscriptionsManager.get(getMessagesKey(clientAddress: clientAddress))?.cancel()
		await subscriptionsManager.set(getMessagesKey(clientAddress: clientAddress), Task {
			do {
				for try await message in try await client.conversations.streamAllDecryptedMessages() {
					do {
						try sendEvent("message", [
							"clientAddress": clientAddress,
							"message": DecodedMessageWrapper.encodeToObj(message, client: client),
						])
					} catch {
						print("discarding message, unable to encode wrapper \(message.id)")
					}
				}
			} catch {
				print("Error in all messages subscription: \(error)")
				await subscriptionsManager.get(getMessagesKey(clientAddress: clientAddress))?.cancel()
			}
		})
	}

	func subscribeToMessages(clientAddress: String, topic: String) async throws {
		guard let conversation = try await findConversation(clientAddress: clientAddress, topic: topic) else {
			return
		}

		guard let client = await clientsManager.getClient(key: clientAddress) else {
			throw Error.noClient
		}

		await subscriptionsManager.get(conversation.cacheKey(clientAddress))?.cancel()
		await subscriptionsManager.set(conversation.cacheKey(clientAddress), Task {
			do {
				for try await message in conversation.streamDecryptedMessages() {
					do {
						try sendEvent("message", [
							"clientAddress": clientAddress,
							"message": DecodedMessageWrapper.encodeToObj(message, client: client),
						])
					} catch {
						print("discarding message, unable to encode wrapper \(message.id)")
					}
				}
			} catch {
				print("Error in messages subscription: \(error)")
				await subscriptionsManager.get(conversation.cacheKey(clientAddress))?.cancel()
			}
		})
	}
	
	func subscribeToGroups(clientAddress: String) async throws {
		guard let client = await clientsManager.getClient(key: clientAddress) else {
			return
		}
		await subscriptionsManager.get(getGroupsKey(clientAddress: clientAddress))?.cancel()
		await subscriptionsManager.set(getGroupsKey(clientAddress: clientAddress), Task {
			do {
				for try await group in try await client.conversations.streamGroups() {
					try sendEvent("group", [
						"clientAddress": clientAddress,
						"conversation": GroupWrapper.encodeToObj(group, client: client),
					])
				}
			} catch {
				print("Error in groups subscription: \(error)")
				await subscriptionsManager.get(getGroupsKey(clientAddress: clientAddress))?.cancel()
			}
		})
	}
	
	func subscribeToAll(clientAddress: String) async throws {
		guard let client = await clientsManager.getClient(key: clientAddress) else {
			return
		}

		await subscriptionsManager.get(getConversationsKey(clientAddress: clientAddress))?.cancel()
		await subscriptionsManager.set(getConversationsKey(clientAddress: clientAddress), Task {
			do {
				for try await conversation in await client.conversations.streamAll() {
					try sendEvent("conversationContainer", [
						"clientAddress": clientAddress,
						"conversation": ConversationContainerWrapper.encodeToObj(conversation, client: client),
					])
				}
			} catch {
				print("Error in all conversations subscription: \(error)")
				await subscriptionsManager.get(getConversationsKey(clientAddress: clientAddress))?.cancel()
			}
		})
	}
	
	func subscribeToGroupMessages(clientAddress: String, id: String) async throws {
		guard let group = try await findGroup(clientAddress: clientAddress, id: id) else {
			return
		}

		guard let client = await clientsManager.getClient(key: clientAddress) else {
			throw Error.noClient
		}

		await subscriptionsManager.get(group.cacheKey(clientAddress))?.cancel()
		await subscriptionsManager.set(group.cacheKey(clientAddress), Task {
			do {
				for try await message in group.streamDecryptedMessages() {
					do {
						try sendEvent("message", [
							"clientAddress": clientAddress,
							"message": DecodedMessageWrapper.encodeToObj(message, client: client),
						])
					} catch {
						print("discarding message, unable to encode wrapper \(message.id)")
					}
				}
			} catch {
				print("Error in group messages subscription: \(error)")
				await subscriptionsManager.get(group.cacheKey(clientAddress))?.cancel()
			}
		})
	}
	

	func unsubscribeFromMessages(clientAddress: String, topic: String) async throws {
		guard let conversation = try await findConversation(clientAddress: clientAddress, topic: topic) else {
			return
		}

		await subscriptionsManager.get(conversation.cacheKey(clientAddress))?.cancel()
	}
	
	func unsubscribeFromGroupMessages(clientAddress: String, id: String) async throws {
		guard let group = try await findGroup(clientAddress: clientAddress, id: id) else {
			return
		}

		await subscriptionsManager.get(group.cacheKey(clientAddress))?.cancel()
	}

	func getMessagesKey(clientAddress: String) -> String {
		return "messages:\(clientAddress)"
	}

	func getConversationsKey(clientAddress: String) -> String {
		return "conversations:\(clientAddress)"
	}
	
	func getGroupsKey(clientAddress: String) -> String {
		return "groups:\(clientAddress)"
	}

	func preEnableIdentityCallback() {
		sendEvent("preEnableIdentityCallback")
		self.preEnableIdentityCallbackDeferred?.wait()
	}

	func preCreateIdentityCallback() {
		sendEvent("preCreateIdentityCallback")
		self.preCreateIdentityCallbackDeferred?.wait()
	}
	
	func requireNotProductionEnvForAlphaMLS(enableAlphaMls: Bool?, environment: String) throws {
		if (enableAlphaMls == true && environment == "production") {
			throw Error.mlsNotEnabled("Environment must be \"local\" or \"dev\" to enable alpha MLS")
		}
	}
}
