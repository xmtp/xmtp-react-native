package expo.modules.xmtpreactnativesdk.wrappers

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
                GroupPermissions.ALL_MEMBERS -> "all_members"
                GroupPermissions.ADMIN_ONLY -> "admin_only"
            }
            return mapOf(
                "clientAddress" to client.address,
                "clientInboxId" to client.inboxId,
                "id" to group.id.toHex(),
                "createdAt" to group.createdAt.time,
                "peerInboxIds" to group.peerInboxIds(),
                "version" to "GROUP",
                "topic" to group.topic,
                "permissionLevel" to permissionString,
                "creatorInboxId" to group.creatorInboxId(),
                "name" to group.name,
                "isActive" to group.isActive()
            )
        }

        fun encode(client: Client, group: Group): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(client, group)
            return gson.toJson(obj)
        }
    }
}