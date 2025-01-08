package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import com.google.gson.JsonParser
import org.xmtp.android.library.libxmtp.PermissionOption
import org.xmtp.android.library.libxmtp.PermissionPolicySet

class PermissionPolicySetWrapper {

    companion object {
        private fun fromPermissionOption(permissionOption: PermissionOption): String {
            return when (permissionOption) {
                PermissionOption.Allow -> "allow"
                PermissionOption.Deny -> "deny"
                PermissionOption.Admin -> "admin"
                PermissionOption.SuperAdmin -> "superAdmin"
                PermissionOption.Unknown -> "unknown"
            }
        }

        private fun createPermissionOptionFromString(permissionOptionString: String): PermissionOption {
            return when (permissionOptionString) {
                "allow" -> PermissionOption.Allow
                "deny" -> PermissionOption.Deny
                "admin" -> PermissionOption.Admin
                "superAdmin" -> PermissionOption.SuperAdmin
                else -> PermissionOption.Unknown
            }
        }
        private fun encodeToObj(policySet: PermissionPolicySet): Map<String, Any> {
            return mapOf(
                "addMemberPolicy" to fromPermissionOption(policySet.addMemberPolicy),
                "removeMemberPolicy" to fromPermissionOption(policySet.removeMemberPolicy),
                "addAdminPolicy" to fromPermissionOption(policySet.addAdminPolicy),
                "removeAdminPolicy" to fromPermissionOption(policySet.removeAdminPolicy),
                "updateGroupNamePolicy" to fromPermissionOption(policySet.updateGroupNamePolicy),
                "updateGroupDescriptionPolicy" to fromPermissionOption(policySet.updateGroupDescriptionPolicy),
                "updateGroupImagePolicy" to fromPermissionOption(policySet.updateGroupImagePolicy),
                "updateGroupPinnedFrameUrlPolicy" to fromPermissionOption(policySet.updateGroupPinnedFrameUrlPolicy),
            )
        }

        fun createPermissionPolicySetFromJson(permissionPolicySetJson: String): PermissionPolicySet {
            val jsonObj = JsonParser.parseString(permissionPolicySetJson).asJsonObject
            return PermissionPolicySet(
                addMemberPolicy = createPermissionOptionFromString(jsonObj.get("addMemberPolicy").asString),
                removeMemberPolicy = createPermissionOptionFromString(jsonObj.get("removeMemberPolicy").asString),
                addAdminPolicy = createPermissionOptionFromString(jsonObj.get("addAdminPolicy").asString),
                removeAdminPolicy = createPermissionOptionFromString(jsonObj.get("removeAdminPolicy").asString),
                updateGroupNamePolicy = createPermissionOptionFromString(jsonObj.get("updateGroupNamePolicy").asString),
                updateGroupDescriptionPolicy = createPermissionOptionFromString(jsonObj.get("updateGroupDescriptionPolicy").asString),
                updateGroupImagePolicy = createPermissionOptionFromString(jsonObj.get("updateGroupImagePolicy").asString),
                updateGroupPinnedFrameUrlPolicy = createPermissionOptionFromString(jsonObj.get("updateGroupPinnedFrameUrlPolicy").asString)
            )
        }

        fun encodeToJsonString(policySet: PermissionPolicySet): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(policySet)
            return gson.toJson(obj)
        }
    }
}
