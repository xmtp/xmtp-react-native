package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.JsonArray
import com.google.gson.JsonParser
import org.xmtp.android.library.ForkRecoveryOptions
import org.xmtp.android.library.ForkRecoveryPolicy
import org.xmtp.android.library.SignerType
import java.math.BigInteger

class AuthParamsWrapper(
    val environment: String,
    val dbDirectory: String?,
    val historySyncUrl: String?,
    val customLocalUrl: String?,
    val deviceSyncEnabled: Boolean,
    val debugEventsEnabled: Boolean,
    val appVersion: String?,
    val gatewayHost: String?,
    val forkRecoveryOptions: ForkRecoveryOptions?
) {
    companion object {
        private fun createForkRecoveryOptions(
            enableRecoveryRequestsString: String?,
            groupsToRequestRecovery: JsonArray?,
            disableRecoveryResponse: Boolean?,
            workerIntervalNs: BigInteger?
        ): ForkRecoveryOptions? {
            // If none of the fork recovery options are provided, return null
            if (enableRecoveryRequestsString == null && 
                groupsToRequestRecovery == null && 
                disableRecoveryResponse == null && 
                workerIntervalNs == null) {
                return null
            }

            // Convert groupsToRequestRecovery JsonArray to List<String>
            val groupsList = groupsToRequestRecovery?.map { it.asString } ?: emptyList()

            //convert BigInt to ULong safely
            val workerIntervalNsLong = workerIntervalNs?.let { bigInt ->
                try {
                    if (bigInt <= BigInteger.valueOf(Long.MAX_VALUE)) {
                        bigInt.toLong().toULong()
                    } else {
                        ULong.MAX_VALUE // Clamp to max value if too large
                    }
                } catch (e: Exception) {
                    null
                }
            }

            return ForkRecoveryOptions(
                enableRecoveryRequests = convertToForkRecoveryPolicy(enableRecoveryRequestsString),
                groupsToRequestRecovery = groupsList,
                disableRecoveryResponses = disableRecoveryResponse,
                workerIntervalNs = workerIntervalNsLong
            )
        }

        private fun convertToForkRecoveryPolicy(enableRecoveryRequestsString: String?): ForkRecoveryPolicy {
            return when (enableRecoveryRequestsString) {
                "none" -> ForkRecoveryPolicy.None
                "all" -> ForkRecoveryPolicy.All
                "groups" -> ForkRecoveryPolicy.AllowlistedGroups
                else -> ForkRecoveryPolicy.None
            }
        }

        fun authParamsFromJson(authParams: String): AuthParamsWrapper {
            val jsonOptions = JsonParser.parseString(authParams).asJsonObject
            val enableRecoveryRequestsString = if (jsonOptions.has("enableRecoveryRequests")) jsonOptions.get("enableRecoveryRequests").asString else null
            val groupsToRequestRecovery = if (jsonOptions.has("groupsToRequestRecovery")) jsonOptions.get("groupsToRequestRecovery").asJsonArray else null
            val disableRecoveryResponse = if (jsonOptions.has("disableRecoveryResponses")) jsonOptions.get("disableRecoveryResponses").asBoolean else null
            val workerIntervalNs = if (jsonOptions.has("workerIntervalNs")) jsonOptions.get("workerIntervalNs").asBigInteger else null

            val forkRecoveryOptions = createForkRecoveryOptions(
                enableRecoveryRequestsString,
                groupsToRequestRecovery,
                disableRecoveryResponse,
                workerIntervalNs
            )

            return AuthParamsWrapper(
                jsonOptions.get("environment").asString,
                if (jsonOptions.has("dbDirectory")) jsonOptions.get("dbDirectory").asString else null,
                if (jsonOptions.has("historySyncUrl")) jsonOptions.get("historySyncUrl").asString else null,
                if (jsonOptions.has("customLocalUrl")) jsonOptions.get("customLocalUrl").asString else null,
                if (jsonOptions.has("deviceSyncEnabled")) jsonOptions.get("deviceSyncEnabled").asBoolean else true,
                if (jsonOptions.has("debugEventsEnabled")) jsonOptions.get("debugEventsEnabled").asBoolean else false,
                if (jsonOptions.has("appVersion")) jsonOptions.get("appVersion").asString else null,
                if (jsonOptions.has("gatewayHost")) jsonOptions.get("gatewayHost").asString else null,
                forkRecoveryOptions
            )
        }
    }
}

class WalletParamsWrapper(
    val signerType: SignerType = SignerType.EOA,
    val chainId: Long?,
    val blockNumber: Long?,
) {
    companion object {
        fun walletParamsFromJson(walletParams: String): WalletParamsWrapper {
            val jsonOptions = JsonParser.parseString(walletParams).asJsonObject
            return WalletParamsWrapper(
                if (jsonOptions.has("signerType")) {
                    when (jsonOptions.get("signerType").asString) {
                        "SCW" -> SignerType.SCW
                        else -> SignerType.EOA
                    }
                } else {
                    SignerType.EOA
                },
                if (jsonOptions.has("chainId")) jsonOptions.get("chainId").asLong else null,
                if (jsonOptions.has("blockNumber")) jsonOptions.get("blockNumber").asLong else null,
            )
        }
    }
}

