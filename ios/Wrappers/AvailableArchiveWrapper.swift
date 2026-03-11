import Foundation
import XMTP

struct AvailableArchiveWrapper {
	let pin: String

	init(_ archive: XMTP.AvailableArchive) {
		self.pin = archive.pin
	}

	func toJsonObject() -> [String: Any] {
		["pin": pin]
	}

	static func encodeList(_ archives: [XMTP.AvailableArchive]) throws -> String {
		let wrappers = archives.map { AvailableArchiveWrapper($0).toJsonObject() }
		let data = try JSONSerialization.data(withJSONObject: wrappers)
		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode AvailableArchive list")
		}
		return result
	}
}
