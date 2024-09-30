package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.ConsentState
import org.xmtp.android.library.libxmtp.Member
import org.xmtp.android.library.libxmtp.PermissionLevel

class MemberWrapper {
    companion object {
        fun encodeToObj(member: Member): Map<String, Any> {
            val permissionString = when (member.permissionLevel) {
                PermissionLevel.MEMBER -> "member"
                PermissionLevel.ADMIN -> "admin"
                PermissionLevel.SUPER_ADMIN -> "super_admin"
            }
            val consentString = when (member.consentState) {
                ConsentState.ALLOWED -> "allowed"
                ConsentState.DENIED -> "denied"
                ConsentState.UNKNOWN -> "unknown"
            }
            return mapOf(
                "inboxId" to member.inboxId,
                "addresses" to member.addresses,
                "permissionLevel" to permissionString,
                "consentState" to consentString
            )
        }

        fun encode(member: Member): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(member)
            return gson.toJson(obj)
        }
    }
}