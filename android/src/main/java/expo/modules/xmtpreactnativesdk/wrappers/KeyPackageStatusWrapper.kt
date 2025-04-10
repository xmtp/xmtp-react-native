package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import org.xmtp.android.library.libxmtp.InboxState
import uniffi.xmtpv3.FfiKeyPackageStatus

class KeyPackageStatusWrapper {
    companion object {
        val gson: Gson = GsonBuilder().create()
        private fun encodeToObj(keyPackageStatus: FfiKeyPackageStatus): Map<String, Any> {
            return mapOf(
                "lifetime" to LifetimeWrapper.encode(keyPackageStatus.lifetime),
                "validationError" to (keyPackageStatus.validationError ?: ""),
            )
        }

        fun encode(keyPackageStatus: FfiKeyPackageStatus): String {
            val obj = encodeToObj(keyPackageStatus)
            return gson.toJson(obj)
        }
    }
}