package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.ConsentState
import org.xmtp.android.library.libxmtp.Member
import org.xmtp.android.library.libxmtp.PermissionLevel

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