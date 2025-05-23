package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import org.xmtp.android.library.ApiStats
import org.xmtp.android.library.IdentityStats
import org.xmtp.android.library.XMTPDebugInformation

class NetworkDebugInfoWrapper {
    companion object {
        val gson: Gson = GsonBuilder().create()
        private fun encodeToObj(info: XMTPDebugInformation): Map<String, Any> {
            return mapOf(
                "apiStatistics" to ApiStatsWrapper.encode(info.apiStatistics),
                "identityStatistics" to IdentityStatsWrapper.encode(info.identityStatistics),
                "aggregateStatistics" to info.aggregateStatistics,
            )
        }

        fun encode(info: XMTPDebugInformation): String {
            val obj = encodeToObj(info)
            return gson.toJson(obj)
        }
    }
}

private class ApiStatsWrapper {
    companion object {
        val gson: Gson = GsonBuilder().create()
        private fun encodeToObj(info: ApiStats): Map<String, Any> {
            return mapOf(
                "uploadKeyPackage" to info.uploadKeyPackage,
                "fetchKeyPackage" to info.fetchKeyPackage,
                "sendGroupMessages" to info.sendGroupMessages,
                "sendWelcomeMessages" to info.sendWelcomeMessages,
                "queryGroupMessages" to info.queryGroupMessages,
                "queryWelcomeMessages" to info.queryWelcomeMessages,
                "subscribeMessages" to info.subscribeMessages,
                "subscribeWelcomes" to info.subscribeWelcomes,
            )
        }

        fun encode(info: ApiStats): String {
            val obj = encodeToObj(info)
            return gson.toJson(obj)
        }
    }
}

private class IdentityStatsWrapper {
    companion object {
        val gson: Gson = GsonBuilder().create()
        private fun encodeToObj(info: IdentityStats): Map<String, Any> {
            return mapOf(
                "publishIdentityUpdate" to info.publishIdentityUpdate,
                "getIdentityUpdatesV2" to info.getIdentityUpdatesV2,
                "getInboxIds" to info.getInboxIds,
                "verifySmartContractWalletSignature" to info.verifySmartContractWalletSignature,
            )
        }

        fun encode(info: IdentityStats): String {
            val obj = encodeToObj(info)
            return gson.toJson(obj)
        }
    }
}