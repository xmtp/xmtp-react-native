package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.Group
import org.xmtp.android.library.toHex

class GroupWrapper {

    companion object {
        fun encodeToObj(client: Client, group: Group): Map<String, Any> {
            return mapOf(
                "clientAddress" to client.address,
                "id" to group.id,
                "createdAt" to group.createdAt.time,
//                "members" to group.members().map { MemberWrapper.encode(it) },
                "version" to "GROUP",
                "topic" to group.topic,
                "creatorInboxId" to group.creatorInboxId(),
                "isActive" to group.isActive(),
                "addedByInboxId" to group.addedByInboxId(),
                "name" to group.name,
                "imageUrlSquare" to group.imageUrlSquare,
                "description" to group.description
                // "pinnedFrameUrl" to group.pinnedFrameUrl
            )
        }

        fun encode(client: Client, group: Group): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(client, group)
            return gson.toJson(obj)
        }
    }
}
