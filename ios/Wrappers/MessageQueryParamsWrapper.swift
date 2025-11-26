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
		let beforeNs = Self.int64FromJson(jsonOptions["beforeNs"])
		let afterNs = Self.int64FromJson(jsonOptions["afterNs"])
		let direction = jsonOptions["direction"] as? String
		// Parse array like Android: get array and map each element to String
		let excludeContentTypes: [String]? = (jsonOptions["excludeContentTypes"] as? [Any])?.compactMap { $0 as? String }
		let excludeSenderInboxIds: [String]? = (jsonOptions["excludeSenderInboxIds"] as? [Any])?.compactMap { $0 as? String }
		let sortBy = jsonOptions["sortBy"] as? String
		let insertedAfterNs = Self.int64FromJson(jsonOptions["insertedAfterNs"])
		let insertedBeforeNs = Self.int64FromJson(jsonOptions["insertedBeforeNs"])

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
