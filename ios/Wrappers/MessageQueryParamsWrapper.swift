import Foundation
import XMTP

struct MessageQueryParamsWrapper {
	let limit: Int?
	let beforeNs: Int64?
	let afterNs: Int64?
	let direction: String?
	let excludeContentTypes: [String]?
	let excludeSenderInboxIds: [String]?
	let sortBy: String?
	let insertedAfterNs: Int64?
	let insertedBeforeNs: Int64?

	static func messageQueryParamsFromJson(_ paramsJson: String)
		-> MessageQueryParamsWrapper
	{
		guard !paramsJson.isEmpty else {
			return MessageQueryParamsWrapper(
				limit: nil,
				beforeNs: nil,
				afterNs: nil,
				direction: nil,
				excludeContentTypes: nil,
				excludeSenderInboxIds: nil,
				sortBy: nil,
				insertedAfterNs: nil,
				insertedBeforeNs: nil
			)
		}

		let data = paramsJson.data(using: .utf8) ?? Data()
		let jsonOptions =
			(try? JSONSerialization.jsonObject(with: data, options: []))
				as? [String: Any] ?? [:]

		let limit = jsonOptions["limit"] as? Int
		let beforeNs = jsonOptions["beforeNs"] as? Int64
		let afterNs = jsonOptions["afterNs"] as? Int64
		let direction = jsonOptions["direction"] as? String
		let excludeContentTypes = jsonOptions["excludeContentTypes"] as? [String]
		let excludeSenderInboxIds = jsonOptions["excludeSenderInboxIds"] as? [String]
		let sortBy = jsonOptions["sortBy"] as? String
		let insertedAfterNs = jsonOptions["insertedAfterNs"] as? Int64
		let insertedBeforeNs = jsonOptions["insertedBeforeNs"] as? Int64

		return MessageQueryParamsWrapper(
			limit: limit,
			beforeNs: beforeNs,
			afterNs: afterNs,
			direction: direction,
			excludeContentTypes: excludeContentTypes,
			excludeSenderInboxIds: excludeSenderInboxIds,
			sortBy: sortBy,
			insertedAfterNs: insertedAfterNs,
			insertedBeforeNs: insertedBeforeNs
		)
	}
}
