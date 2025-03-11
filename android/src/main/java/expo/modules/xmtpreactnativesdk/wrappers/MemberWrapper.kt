package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.libxmtp.Member
import org.xmtp.android.library.libxmtp.PermissionLevel
import org.xmtp.android.library.toHex
import uniffi.xmtpv3.FfiUpdateGroupMembershipResult
import uniffi.xmtpv3.org.xmtp.android.library.libxmtp.GroupMembershipResult

class MemberWrapper {
    companion object {
        private fun encodeToObj(member: Member): Map<String, Any> {
            val permissionString = when (member.permissionLevel) {
                PermissionLevel.MEMBER -> "member"
                PermissionLevel.ADMIN -> "admin"
                PermissionLevel.SUPER_ADMIN -> "super_admin"
            }
            return mapOf(
                "inboxId" to member.inboxId,
                "identities" to member.identities.map { PublicIdentityWrapper.encode(it) },
                "permissionLevel" to permissionString,
                "consentState" to consentStateToString(member.consentState)
            )
        }

        fun encode(member: Member): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(member)
            return gson.toJson(obj)
        }
    }
}

class MembershipResultWrapper {
    companion object {
        private fun encodeToObj(result: GroupMembershipResult): Map<String, Any> {
            return mapOf(
                "addedMembers" to result.addedMembers,
                "removedMembers" to result.removedMembers,
                "failedInstallationIds" to result.failedInstallationIds,
            )
        }

        fun encode(result: GroupMembershipResult): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(result)
            return gson.toJson(obj)
        }
    }
}