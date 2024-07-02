package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import uniffi.xmtpv3.org.xmtp.android.library.libxmtp.PermissionOption
import uniffi.xmtpv3.org.xmtp.android.library.libxmtp.PermissionPolicySet

class PermissionPolicySetWrapper {

    companion object {
        fun fromPermissionOption(permissionOption: PermissionOption): String {
            return when (permissionOption) {
                PermissionOption.Allow -> "allow"
                PermissionOption.Deny -> "deny"
                PermissionOption.Admin -> "admin"
                PermissionOption.SuperAdmin -> "superAdmin"
                PermissionOption.Unknown -> "unknown"
            }
        }
        fun encodeToObj(policySet: PermissionPolicySet): Map<String, Any> {
            return mapOf(
                "addMemberPolicy" to fromPermissionOption(policySet.addMemberPolicy),
                "removeMemberPolicy" to fromPermissionOption(policySet.removeMemberPolicy),
                "addAdminPolicy" to fromPermissionOption(policySet.addAdminPolicy),
                "removeAdminPolicy" to fromPermissionOption(policySet.removeAdminPolicy),
                "updateGroupNamePolicy" to fromPermissionOption(policySet.updateGroupNamePolicy),
                "updateGroupDescriptionPolicy" to fromPermissionOption(policySet.updateGroupDescriptionPolicy),
                "updateGroupImagePolicy" to fromPermissionOption(policySet.updateGroupImagePolicy),
            )
        }

        fun encodeToJsonString(policySet: PermissionPolicySet): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(policySet)
            return gson.toJson(obj)
        }
    }
}
