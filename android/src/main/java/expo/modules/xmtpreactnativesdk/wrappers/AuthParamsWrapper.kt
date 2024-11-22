package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.JsonParser
import org.xmtp.android.library.WalletType

class AuthParamsWrapper(
    val environment: String,
    val appVersion: String?,
    val dbDirectory: String?,
    val historySyncUrl: String?,
) {
    companion object {
        fun authParamsFromJson(authParams: String): AuthParamsWrapper {
            val jsonOptions = JsonParser.parseString(authParams).asJsonObject
            return AuthParamsWrapper(
                jsonOptions.get("environment").asString,
                if (jsonOptions.has("appVersion")) jsonOptions.get("appVersion").asString else null,
                if (jsonOptions.has("dbDirectory")) jsonOptions.get("dbDirectory").asString else null,
                if (jsonOptions.has("historySyncUrl")) jsonOptions.get("historySyncUrl").asString else null,
            )
        }
    }
}

class WalletParamsWrapper(
    val walletType: WalletType = WalletType.EOA,
    val chainId: Long?,
    val blockNumber: Long?,

    ) {
    companion object {
        fun walletParamsFromJson(walletParams: String): WalletParamsWrapper {
            val jsonOptions = JsonParser.parseString(walletParams).asJsonObject
            return WalletParamsWrapper(
                if (jsonOptions.has("walletType")) {
                    when (jsonOptions.get("walletType").asString) {
                        "SCW" -> WalletType.SCW
                        else -> WalletType.EOA
                    }
                } else {
                    WalletType.EOA
                },
                if (jsonOptions.has("chainId")) jsonOptions.get("chainId").asLong else null,
                if (jsonOptions.has("blockNumber")) jsonOptions.get("blockNumber").asLong else null,
            )
        }
    }
}

