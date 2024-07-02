package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.Group
import org.xmtp.android.library.toHex

class GroupWrapper {

    companion object {
        fun encodeToObj(client: Client, group: Group): Map<String, Any> {
            val permissionPolicySet = PermissionPolicySetWrapper.encodeToJsonString(group.permissionPolicySet())
            return mapOf(
                "clientAddress" to client.address,
                "id" to group.id.toHex(),
                "createdAt" to group.createdAt.time,
                "peerInboxIds" to group.peerInboxIds(),
                "version" to "GROUP",
                "topic" to group.topic,
                "creatorInboxId" to group.creatorInboxId(),
                "name" to group.name,
                "isActive" to group.isActive(),
                "imageUrlSquare" to group.imageUrlSquare,
                "description" to group.description
            )
        }

        fun encode(client: Client, group: Group): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(client, group)
            return gson.toJson(obj)
        }
    }
}
