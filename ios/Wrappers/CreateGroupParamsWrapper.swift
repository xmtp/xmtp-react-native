import Foundation

struct CreateGroupParamsWrapper {
    let groupName: String
    let groupImageUrlSquare: String
    let groupDescription: String
    let groupPinnedFrameUrl: String

    static func createGroupParamsFromJson(_ authParams: String) -> CreateGroupParamsWrapper {
        let data = authParams.data(using: .utf8) ?? Data()
        let jsonOptions = (try? JSONSerialization.jsonObject(with: data, options: [])) as? [String: Any] ?? [:]
        
        let groupName = jsonOptions["name"] as? String ?? ""
        let groupImageUrlSquare = jsonOptions["imageUrlSquare"] as? String ?? ""
        let groupDescription = jsonOptions["description"] as? String ?? ""
        let groupPinnedFrameUrl = jsonOptions["pinnedFrameUrl"] as? String ?? ""
        
        return CreateGroupParamsWrapper(
            groupName: groupName,
            groupImageUrlSquare: groupImageUrlSquare,
            groupDescription: groupDescription,
            groupPinnedFrameUrl: groupPinnedFrameUrl
        )
    }
}
