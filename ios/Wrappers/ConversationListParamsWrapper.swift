import Foundation
import XMTP

struct ConversationListParamsWrapper {
	let createdAfterNs: Int64?
	let createdBeforeNs: Int64?
	let lastActivityAfterNs: Int64?
	let lastActivityBeforeNs: Int64?
	let limit: Int?
	let consentStates: [ConsentState]?
	let orderBy: ConversationsOrderBy?

	static func conversationListParamsFromJson(_ paramsJson: String)
		-> ConversationListParamsWrapper
	{
		guard !paramsJson.isEmpty else {
			return ConversationListParamsWrapper(
				createdAfterNs: nil,
				createdBeforeNs: nil,
				lastActivityAfterNs: nil,
				lastActivityBeforeNs: nil,
				limit: nil,
				consentStates: nil,
				orderBy: nil
			)
		}

		let data = paramsJson.data(using: .utf8) ?? Data()
		let jsonOptions =
			(try? JSONSerialization.jsonObject(with: data, options: []))
			as? [String: Any] ?? [:]

		let createdAfterNs = jsonOptions["createdAfterNs"] as? Int64
		let createdBeforeNs = jsonOptions["createdBeforeNs"] as? Int64
		let lastActivityAfterNs = jsonOptions["lastActivityAfterNs"] as? Int64
		let lastActivityBeforeNs = jsonOptions["lastActivityBeforeNs"] as? Int64
		let limit = jsonOptions["limit"] as? Int

		var consentStates: [ConsentState]? = nil
		if let statesArray = jsonOptions["consentStates"] as? [String] {
			consentStates = statesArray.map { state in
				switch state.lowercased() {
				case "allowed":
					return .allowed
				case "denied":
					return .denied
				default:
					return .unknown
				}
			}
		}

		var orderBy: ConversationsOrderBy? = nil
		if let orderByString = jsonOptions["orderBy"] as? String {
			switch orderByString.lowercased() {
			case "created_at":
				orderBy = .createdAt
			case "last_activity":
				orderBy = .lastActivity
			default:
				orderBy = .lastActivity
			}
		}

		return ConversationListParamsWrapper(
			createdAfterNs: createdAfterNs,
			createdBeforeNs: createdBeforeNs,
			lastActivityAfterNs: lastActivityAfterNs,
			lastActivityBeforeNs: lastActivityBeforeNs,
			limit: limit,
			consentStates: consentStates,
			orderBy: orderBy
		)
	}
}
