//
//  PermissionPolicySetWrapper.swift
//  XMTPReactNative
//
//  Created by Naomi Plasterer on 7/1/24.
//

import Foundation
import XMTP

class PermissionPolicySetWrapper {
    static func fromPermissionOption(_ permissionOption: XMTP.PermissionOption) -> String {
        switch permissionOption {
        case .allow:
            return "allow"
        case .deny:
            return "deny"
        case .admin:
            return "admin"
        case .superAdmin:
            return "superAdmin"
        case .unknown:
            return "unknown"
        }
    }
    
    static func createPermissionOption(from string: String) -> PermissionOption {
        switch string {
        case "allow":
            return .allow
        case "deny":
            return .deny
        case "admin":
            return .admin
        case "superAdmin":
            return .superAdmin
        default:
            return .unknown
        }
    }
    
    
    static func encodeToObj(_ policySet: XMTP.PermissionPolicySet) -> [String: Any] {
        
        return [
            "addMemberPolicy": fromPermissionOption(policySet.addMemberPolicy),
            "removeMemberPolicy": fromPermissionOption(policySet.removeMemberPolicy),
            "addAdminPolicy": fromPermissionOption(policySet.addAdminPolicy),
            "removeAdminPolicy": fromPermissionOption(policySet.removeAdminPolicy),
            "updateGroupNamePolicy": fromPermissionOption(policySet.updateGroupNamePolicy),
            "updateGroupDescriptionPolicy": fromPermissionOption(policySet.updateGroupDescriptionPolicy),
            "updateGroupImagePolicy": fromPermissionOption(policySet.updateGroupImagePolicy),
            "updateMessageDisappearingPolicy": fromPermissionOption(policySet.updateMessageDisappearingPolicy)
        ]
    }
    public static func createPermissionPolicySet(from json: String) throws -> PermissionPolicySet {
        guard let data = json.data(using: .utf8) else {
            throw WrapperError.decodeError("Failed to convert PermissionPolicySet JSON string to data")
        }
        
        guard let jsonObject = try? JSONSerialization.jsonObject(with: data, options: []),
              let jsonDict = jsonObject as? [String: Any] else {
            throw WrapperError.decodeError("Failed to parse PermissionPolicySet JSON data")
        }
        
        return PermissionPolicySet(
            addMemberPolicy: createPermissionOption(from: jsonDict["addMemberPolicy"] as? String ?? ""),
            removeMemberPolicy: createPermissionOption(from: jsonDict["removeMemberPolicy"] as? String ?? ""),
            addAdminPolicy: createPermissionOption(from: jsonDict["addAdminPolicy"] as? String ?? ""),
            removeAdminPolicy: createPermissionOption(from: jsonDict["removeAdminPolicy"] as? String ?? ""),
            updateGroupNamePolicy: createPermissionOption(from: jsonDict["updateGroupNamePolicy"] as? String ?? ""),
            updateGroupDescriptionPolicy: createPermissionOption(from: jsonDict["updateGroupDescriptionPolicy"] as? String ?? ""),
            updateGroupImagePolicy: createPermissionOption(from: jsonDict["updateGroupImagePolicy"] as? String ?? ""),
            updateMessageDisappearingPolicy: createPermissionOption(from: jsonDict["updateMessageDisappearingPolicy"] as? String ?? "")
        )
    }
    
    static func encodeToJsonString(_ policySet: XMTP.PermissionPolicySet) throws -> String {
        let obj = encodeToObj(policySet)
        let data = try JSONSerialization.data(withJSONObject: obj)
        guard let result = String(data: data, encoding: .utf8) else {
            throw WrapperError.encodeError("could not encode permission policy")
        }
        return result
    }
    
}
