package expo.modules.xmtpreactnativesdk.wrappers

import org.xmtp.android.library.Client

class ClientWrapper {
    companion object {
        fun encodeToObj(client: Client): Map<String, String> {
            return mapOf(
                "inboxId" to client.inboxId,
                "address" to client.address,
                "installationId" to client.installationId,
                "dbPath" to client.dbPath
            )
        }
    }
}