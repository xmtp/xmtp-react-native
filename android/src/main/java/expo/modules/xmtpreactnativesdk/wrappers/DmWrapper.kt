package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import org.xmtp.android.library.Client
import org.xmtp.android.library.Dm

class DmWrapper {
    companion object {
        suspend fun encodeToObj(
            client: Client,
            dm: Dm,
            dmParams: ConversationParamsWrapper = ConversationParamsWrapper(),
        ): Map<String, Any> {
            return buildMap {
                put("clientInboxId", client.inboxId)
                put("id", dm.id)
                put("createdAt", dm.createdAt.time)
                put("version", "DM")
                put("topic", dm.topic)
                put("peerInboxId", dm.peerInboxId)
                put("commitLogForkStatus", ConversationDebugInfoWrapper.commitLogForkStatusToString(dm.commitLogForkStatus()))
                if (dmParams.consentState) {
                    put("consentState", consentStateToString(dm.consentState()))
                }
                if (dmParams.lastMessage) {
                    val lastMessage = dm.lastMessage()
                    if (lastMessage != null) {
                        put("lastMessage", MessageWrapper.encode(lastMessage))
                    }
                }
            }
        }

        suspend fun encode(
            client: Client,
            dm: Dm,
            dmParams: ConversationParamsWrapper = ConversationParamsWrapper(),
        ): String {
            val gson = GsonBuilder().create()
            val obj = encodeToObj(client, dm, dmParams)
            return gson.toJson(obj)
        }
    }
}
