package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.JsonParser
import org.xmtp.android.library.SignerType

class AuthParamsWrapper(
    val environment: String,
    val dbDirectory: String?,
    val historySyncUrl: String?,
    val customLocalUrl: String?,
    val deviceSyncEnabled: Boolean,
    val debugEventsEnabled: Boolean,
    val appVersion: String?,
) {
    companion object {
        fun authParamsFromJson(authParams: String): AuthParamsWrapper {
            val jsonOptions = JsonParser.parseString(authParams).asJsonObject
            return AuthParamsWrapper(
                jsonOptions.get("environment").asString,
                if (jsonOptions.has("dbDirectory")) jsonOptions.get("dbDirectory").asString else null,
                if (jsonOptions.has("historySyncUrl")) jsonOptions.get("historySyncUrl").asString else null,
                if (jsonOptions.has("customLocalUrl")) jsonOptions.get("customLocalUrl").asString else null,
                if (jsonOptions.has("deviceSyncEnabled")) jsonOptions.get("deviceSyncEnabled").asBoolean else true,
                if (jsonOptions.has("debugEventsEnabled")) jsonOptions.get("debugEventsEnabled").asBoolean else false,
                if (jsonOptions.has("appVersion")) jsonOptions.get("appVersion").asString else null,
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

