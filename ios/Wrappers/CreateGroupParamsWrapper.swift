import Foundation
import XMTP

struct CreateGroupParamsWrapper {
	let groupName: String
	let groupImageUrl: String
	let groupDescription: String
	let disappearingMessageSettings: DisappearingMessageSettings?
	let appData: String?

	static func createGroupParamsFromJson(_ authParams: String)
		-> CreateGroupParamsWrapper
	{
		let data = authParams.data(using: .utf8) ?? Data()
		let jsonOptions =
			(try? JSONSerialization.jsonObject(with: data, options: []))
				as? [String: Any] ?? [:]

		var settings: DisappearingMessageSettings? = nil

		// Only create DisappearingMessageSettings if both values are provided
		if let disappearStartingAtNs = jsonOptions["disappearStartingAtNs"] as? Int64,
		   let retentionDurationInNs = jsonOptions["retentionDurationInNs"] as? Int64
		{
			settings = DisappearingMessageSettings(
				disappearStartingAtNs: disappearStartingAtNs,
				retentionDurationInNs: retentionDurationInNs
			)
		}

		let groupName = jsonOptions["name"] as? String ?? ""
		let groupImageUrl = jsonOptions["imageUrl"] as? String ?? ""
		let groupDescription = jsonOptions["description"] as? String ?? ""
		let appData = jsonOptions["appData"] as? String

		return CreateGroupParamsWrapper(
			groupName: groupName,
			groupImageUrl: groupImageUrl,
			groupDescription: groupDescription,
			disappearingMessageSettings: settings,
			appData: appData
		)
	}
}
