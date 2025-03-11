import Foundation
import XMTP

struct CreateGroupParamsWrapper {
	let groupName: String
	let groupImageUrl: String
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
		let groupImageUrl = jsonOptions["imageUrl"] as? String ?? ""
		let groupDescription = jsonOptions["description"] as? String ?? ""

		return CreateGroupParamsWrapper(
			groupName: groupName,
			groupImageUrl: groupImageUrl,
			groupDescription: groupDescription,
			disappearingMessageSettings: settings
		)
	}
}
