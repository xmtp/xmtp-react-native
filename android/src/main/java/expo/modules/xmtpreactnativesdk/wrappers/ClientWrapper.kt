package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client

class ClientWrapper {
    companion object {
        fun encodeToObj(client: Client): Map<String, String> {
            return mapOf(
                "inboxId" to client.inboxId,
                "address" to client.address,
                "installationId" to client.installationId
            )
        }

        fun encode(client: Client): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(client)
            return gson.toJson(obj)
        }
    }
}