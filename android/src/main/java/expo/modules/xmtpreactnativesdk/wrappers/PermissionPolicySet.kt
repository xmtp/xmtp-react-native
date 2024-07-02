package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import expo.modules.kotlin.types.Enumerable
import org.xmtp.android.library.Client
import org.xmtp.android.library.Group
import uniffi.xmtpv3.org.xmtp.android.library.libxmtp.PermissionOption
import uniffi.xmtpv3.org.xmtp.android.library.libxmtp.PermissionPolicySet

enum class ExpoPermissionOption(val value: String) : Enumerable {
    Allow("Allow"),
    Deny("Deny"),
    Admin("Admin"),
    SuperAdmin("SuperAdmin"),
    Unknown("Unknown");
    companion object {
        fun fromPermissionOption(permissionOption: PermissionOption): ExpoPermissionOption {
            return when (permissionOption) {
                PermissionOption.Allow -> Allow
                PermissionOption.Deny -> Deny
                PermissionOption.Admin -> Admin
                PermissionOption.SuperAdmin -> SuperAdmin
                PermissionOption.Unknown -> Unknown
            }
        }
    }
}

class PermissionPolicySetWrapper {

    companion object {
        fun encodeToObj(policySet: PermissionPolicySet): Map<String, Any> {

            return mapOf(
                "addMemberPolicy" to ExpoPermissionOption.fromPermissionOption(policySet.addMemberPolicy),
                "removeMemberPolicy" to ExpoPermissionOption.fromPermissionOption(policySet.removeMemberPolicy),
                "addAdminPolicy" to ExpoPermissionOption.fromPermissionOption(policySet.addAdminPolicy),
                "removeAdminPolicy" to ExpoPermissionOption.fromPermissionOption(policySet.removeAdminPolicy),
                "updateGroupNamePolicy" to ExpoPermissionOption.fromPermissionOption(policySet.updateGroupNamePolicy),
                "updateGroupDescriptionPolicy" to ExpoPermissionOption.fromPermissionOption(policySet.updateGroupDescriptionPolicy),
                "updateGroupImagePolicy" to ExpoPermissionOption.fromPermissionOption(policySet.updateGroupImagePolicy),
            )
        }

        fun encode(client: Client, group: Group): String {
            val gson = GsonBuilder().create()
            val obj = GroupWrapper.encodeToObj(client, group)
            return gson.toJson(obj)
        }
    }
}