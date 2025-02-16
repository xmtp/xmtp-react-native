import Foundation
import XMTP

struct CreateGroupParamsWrapper {
	let groupName: String
	let groupImageUrlSquare: String
	let groupDescription: String
	let disappearingMessageSettings: DisappearingMessageSettings

	static func createGroupParamsFromJson(_ authParams: String)
		-> CreateGroupParamsWrapper
	{
		let data = authParams.data(using: .utf8) ?? Data()
		let jsonOptions =
			(try? JSONSerialization.jsonObject(with: data, options: []))
			as? [String: Any] ?? [:]

		let settings = DisappearingMessageSettings(
			disappearStartingAtNs: jsonOptions["disappearStartingAtNs"]
				as? Int64 ?? 0,
			retentionDurationInNs: jsonOptions["retentionDurationInNs"]
				as? Int64 ?? 0
		)

		let groupName = jsonOptions["name"] as? String ?? ""
		let groupImageUrlSquare = jsonOptions["imageUrlSquare"] as? String ?? ""
		let groupDescription = jsonOptions["description"] as? String ?? ""

		return CreateGroupParamsWrapper(
			groupName: groupName,
			groupImageUrlSquare: groupImageUrlSquare,
			groupDescription: groupDescription,
			disappearingMessageSettings: settings
		)
	}
}
