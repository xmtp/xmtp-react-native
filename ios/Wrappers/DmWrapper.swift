//
//  DmWrapper.swift
//  Pods
//
//  Created by Naomi Plasterer on 10/24/24.
//

import Foundation
import XMTP

// Wrapper around XMTP.Dm to allow passing these objects back into react native.
struct DmWrapper {
	static func encodeToObj(_ dm: XMTP.Dm, client: XMTP.Client, conversationParams: ConversationParamsWrapper = ConversationParamsWrapper()) async throws -> [String: Any] {
		var result: [String: Any] = [
			"clientInboxId": client.inboxID,
			"id": dm.id,
			"createdAt": UInt64(dm.createdAt.timeIntervalSince1970 * 1000),
			"version": "DM",
			"topic": dm.topic,
			"peerInboxId": try dm.peerInboxId,
			"commitLogForkStatus": ConversationDebugInfoWrapper.commitLogForkStatusToString(dm.commitLogForkStatus())
		]

		if conversationParams.consentState {
			result["consentState"] = ConsentWrapper.consentStateToString(state: try dm.consentState())
		}
		if conversationParams.lastMessage {
			if let lastMessage = try await dm.lastMessage() {
				result["lastMessage"] = try MessageWrapper.encode(lastMessage)
			}
		}
		
		return result
	}

	static func encode(_ dm: XMTP.Dm, client: XMTP.Client, conversationParams: ConversationParamsWrapper = ConversationParamsWrapper()) async throws -> String {
		let obj = try await encodeToObj(dm, client: client, conversationParams: conversationParams)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode dm")
		}
		return result
	}
}

