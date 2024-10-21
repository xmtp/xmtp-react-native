package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.JsonParser

class AuthParamsWrapper(
    val environment: String,
    val appVersion: String?,
    val enableV3: Boolean = false,
    val dbDirectory: String?,
    val historySyncUrl: String?,
    val isSmartContractWallet: Boolean = false,
    val chainId: Long?,
    val blockNumber: Long?,
    ) {
    companion object {
        fun authParamsFromJson(authParams: String): AuthParamsWrapper {
            val jsonOptions = JsonParser.parseString(authParams).asJsonObject
            return AuthParamsWrapper(
                jsonOptions.get("environment").asString,
                if (jsonOptions.has("appVersion")) jsonOptions.get("appVersion").asString else null,
                if (jsonOptions.has("enableV3")) jsonOptions.get("enableV3").asBoolean else false,
                if (jsonOptions.has("dbDirectory")) jsonOptions.get("dbDirectory").asString else null,
                if (jsonOptions.has("historySyncUrl")) jsonOptions.get("historySyncUrl").asString else null,
                if (jsonOptions.has("isSmartContractWallet")) jsonOptions.get("isSmartContractWallet").asBoolean else false,
                if (jsonOptions.has("chainId")) jsonOptions.get("chainId").asLong else null,
                if (jsonOptions.has("blockNumber")) jsonOptions.get("blockNumber").asLong else null,

                )
        }
    }
}
