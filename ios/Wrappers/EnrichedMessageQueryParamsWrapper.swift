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

	/// JSONSerialization decodes numbers as Int or Double; coerce to Int64 so ns timestamps parse correctly.
	/// Also accepts numeric strings so JS can pass large ns values without precision loss.
	private static func int64FromJson(_ value: Any?) -> Int64? {
		guard let v = value else { return nil }
		if let n = v as? Int64 { return n }
		if let n = v as? Int { return Int64(n) }
		if let n = v as? Double { return Int64(n) }
		if let n = v as? NSNumber { return n.int64Value }
		if let s = v as? String { return Int64(s) }
		return nil
	}

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
		let beforeNs = Self.int64FromJson(jsonOptions["beforeNs"])
		let afterNs = Self.int64FromJson(jsonOptions["afterNs"])
		let direction = jsonOptions["direction"] as? String
		let excludeSenderInboxIds: [String]? = (jsonOptions["excludeSenderInboxIds"] as? [Any])?.compactMap { $0 as? String }
		let deliveryStatus = jsonOptions["deliveryStatus"] as? String
		let insertedAfterNs = Self.int64FromJson(jsonOptions["insertedAfterNs"])
		let insertedBeforeNs = Self.int64FromJson(jsonOptions["insertedBeforeNs"])
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
