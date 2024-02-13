package expo.modules.xmtpreactnativesdk.wrappers

import android.util.Base64
import android.util.Base64.NO_WRAP
import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.Group

class GroupWrapper {

    companion object {
        fun encodeToObj(client: Client, group: Group, id: String): Map<String, Any> {
            return mapOf(
                "clientAddress" to client.address,
                "id" to id,
                "createdAt" to group.createdAt.time,
                "peerAddresses" to group.memberAddresses(),
                "version" to "group",
                "topic" to id 
            )
        }

        fun encode(client: Client, group: Group): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(client, group, Base64.encodeToString(group.id, NO_WRAP))
            return gson.toJson(obj)
        }
    }
}