import Foundation
import XMTP

struct DisappearingMessageSettingsWrapper {
	static func encodeToObj(_ settings: XMTP.DisappearingMessageSettings) throws
		-> [String: Any]
	{
		return [
			"disappearStartingAtNs": settings.disappearStartingAtNs,
			"retentionDurationInNs": settings.retentionDurationInNs,
		]
	}

	static func encode(_ entry: XMTP.DisappearingMessageSettings) throws
		-> String
	{
		let obj = try encodeToObj(entry)
		let data = try JSONSerialization.data(withJSONObject: obj)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode expirations")
		}
		return result
	}
}
