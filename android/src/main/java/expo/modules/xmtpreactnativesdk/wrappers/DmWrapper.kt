package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.GsonBuilder
import com.google.gson.JsonParser
import expo.modules.xmtpreactnativesdk.wrappers.ConsentWrapper.Companion.consentStateToString
import org.xmtp.android.library.Client
import org.xmtp.android.library.Dm
import org.xmtp.android.library.Group

class DmWrapper {
    companion object {
        suspend fun encodeToObj(
            client: Client,
            dm: Dm,
            dmParams: ConversationParamsWrapper = ConversationParamsWrapper(),
        ): Map<String, Any> {
            return buildMap {
                put("clientAddress", client.address)
                put("id", dm.id)
                put("createdAt", dm.createdAt.time)
                put("version", "DM")
                put("topic", dm.topic)
                put("peerInboxId", dm.peerInboxId)
                if (dmParams.consentState) {
                    put("consentState", consentStateToString(dm.consentState()))
                }
                if (dmParams.lastMessage) {
                    val lastMessage = dm.decryptedMessages(limit = 1).firstOrNull()
                    if (lastMessage != null) {
                        put("lastMessage", DecodedMessageWrapper.encode(lastMessage))
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
