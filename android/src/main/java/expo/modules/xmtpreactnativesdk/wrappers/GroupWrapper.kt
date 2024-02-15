package expo.modules.xmtpreactnativesdk.wrappers

import android.util.Base64
import android.util.Base64.NO_WRAP
import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.Group
import org.xmtp.android.library.toHex

class GroupWrapper {

    companion object {
        fun encodeToObj(client: Client, group: Group): Map<String, Any> {
            return mapOf(
                "clientAddress" to client.address,
                "id" to group.id.toHex(),
                "createdAt" to group.createdAt.time,
                "peerAddresses" to group.memberAddresses(),
                "version" to "GROUP",
                "topic" to group.id.toHex()
            )
        }

        fun encode(client: Client, group: Group): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(client, group)
            return gson.toJson(obj)
        }
    }
}