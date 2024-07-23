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

	static func encodeToObj(_ policySet: XMTP.PermissionPolicySet) -> [String: Any] {
		return [
			"addMemberPolicy": fromPermissionOption(policySet.addMemberPolicy),
			"removeMemberPolicy": fromPermissionOption(policySet.removeMemberPolicy),
			"addAdminPolicy": fromPermissionOption(policySet.addAdminPolicy),
			"removeAdminPolicy": fromPermissionOption(policySet.removeAdminPolicy),
			"updateGroupNamePolicy": fromPermissionOption(policySet.updateGroupNamePolicy),
			"updateGroupDescriptionPolicy": fromPermissionOption(policySet.updateGroupDescriptionPolicy),
			"updateGroupImagePolicy": fromPermissionOption(policySet.updateGroupImagePolicy),
			"updateGroupPinnedFrameUrlPolicy": fromPermissionOption(policySet.updateGroupPinnedFrameUrlPolicy)
		]
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
