package expo.modules.xmtpreactnativesdk.wrappers

import android.util.Base64
import android.util.Base64.NO_WRAP
import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.Conversation
import org.xmtp.android.library.Group
import org.xmtp.android.library.toHex
import uniffi.xmtpv3.GroupPermissions

class GroupWrapper {

    companion object {
        fun encodeToObj(client: Client, group: Group): Map<String, Any> {
            val permissionString = when (group.permissionLevel()) {
                GroupPermissions.EVERYONE_IS_ADMIN -> "everyone_admin"
                GroupPermissions.GROUP_CREATOR_IS_ADMIN -> "creator_admin"
            }
            return mapOf(
                "clientAddress" to client.address,
                "id" to group.id.toHex(),
                "createdAt" to group.createdAt.time,
                "peerAddresses" to Conversation.Group(group).peerAddresses,
                "version" to "GROUP",
                "topic" to group.topic,
                "permissionLevel" to permissionString,
                "adminAddress" to group.adminAddress()
            )
        }

        fun encode(client: Client, group: Group): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(client, group)
            return gson.toJson(obj)
        }
    }
}