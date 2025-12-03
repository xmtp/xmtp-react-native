import Foundation
import XMTP

struct GroupSyncSummaryWrapper: Codable {
	var numEligible: UInt64
	var numSynced: UInt64

	init(_ summary: XMTP.GroupSyncSummary) {
		self.numEligible = summary.numEligible
		self.numSynced = summary.numSynced
	}

	func toJson() throws -> String {
		let data = try JSONEncoder().encode(self)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode GroupSyncSummary")
		}
		return result
	}
}
