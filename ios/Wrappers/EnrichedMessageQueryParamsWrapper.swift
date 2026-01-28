import Foundation
import XMTP

struct EnrichedMessageQueryParamsWrapper {
	let limit: Int?
	let beforeNs: Int64?
	let afterNs: Int64?
	let direction: String?
	let excludeSenderInboxIds: [String]?
	let deliveryStatus: String?
	let insertedAfterNs: Int64?
	let insertedBeforeNs: Int64?
	let sortBy: String?

	static func fromJson(_ paramsJson: String) -> EnrichedMessageQueryParamsWrapper {
		guard !paramsJson.isEmpty else {
			return EnrichedMessageQueryParamsWrapper(
				limit: nil,
				beforeNs: nil,
				afterNs: nil,
				direction: nil,
				excludeSenderInboxIds: nil,
				deliveryStatus: nil,
				insertedAfterNs: nil,
				insertedBeforeNs: nil,
				sortBy: nil
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
		let excludeSenderInboxIds = jsonOptions["excludeSenderInboxIds"] as? [String]
		let deliveryStatus = jsonOptions["deliveryStatus"] as? String
		let insertedAfterNs = jsonOptions["insertedAfterNs"] as? Int64
		let insertedBeforeNs = jsonOptions["insertedBeforeNs"] as? Int64
		let sortBy = jsonOptions["sortBy"] as? String

		return EnrichedMessageQueryParamsWrapper(
			limit: limit,
			beforeNs: beforeNs,
			afterNs: afterNs,
			direction: direction,
			excludeSenderInboxIds: excludeSenderInboxIds,
			deliveryStatus: deliveryStatus,
			insertedAfterNs: insertedAfterNs,
			insertedBeforeNs: insertedBeforeNs,
			sortBy: sortBy
		)
	}
}
