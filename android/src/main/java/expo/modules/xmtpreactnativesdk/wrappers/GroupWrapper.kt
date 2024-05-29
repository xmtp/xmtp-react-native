package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.Conversation
import org.xmtp.android.library.Group
import org.xmtp.android.library.toHex

class GroupWrapper {

    companion object {
        fun encodeToObj(client: Client, group: Group): Map<String, Any> {
//            val permissionString = when (group.permissionLevel()) {
//                GroupPermissions.EVERYONE_IS_ADMIN -> "everyone_admin"
//                GroupPermissions.GROUP_CREATOR_IS_ADMIN -> "creator_admin"
//            }
            return mapOf(
                "clientAddress" to client.address,
                "clientInboxId" to client.inboxId,
                "id" to group.id.toHex(),
                "createdAt" to group.createdAt.time,
                "peerInboxIds" to group.peerInboxIds,
                "version" to "GROUP",
                "topic" to group.topic,
//                "permissionLevel" to permissionString,
                "adminInboxId" to group.adminInboxId(),
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