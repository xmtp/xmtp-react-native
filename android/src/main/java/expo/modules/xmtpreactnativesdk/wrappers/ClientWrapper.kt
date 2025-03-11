package expo.modules.xmtpreactnativesdk.wrappers

import org.xmtp.android.library.Client

class ClientWrapper {
    companion object {
        fun encodeToObj(client: Client): Map<String, String> {
            return mapOf(
                "inboxId" to client.inboxId,
                "installationId" to client.installationId,
                "dbPath" to client.dbPath,
                "publicIdentity" to PublicIdentityWrapper.encode(client.publicIdentity)
            )
        }
    }
}