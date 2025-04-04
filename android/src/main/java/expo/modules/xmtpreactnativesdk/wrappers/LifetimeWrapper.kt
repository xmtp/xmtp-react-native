package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import org.xmtp.android.library.libxmtp.InboxState
import uniffi.xmtpv3.FfiKeyPackageStatus
import uniffi.xmtpv3.FfiLifetime

class LifetimeWrapper {
    companion object {
        val gson: Gson = GsonBuilder().create()
        private fun encodeToObj(lifetime: FfiLifetime?): Map<String, Any> {
            return mapOf(
                "notBefore" to (lifetime?.notBefore?.toInt() ?: -1),
                "notAfter" to (lifetime?.notAfter?.toInt() ?: -1),
            )
        }

        fun encode(lifetime: FfiLifetime?): String {
            val obj = encodeToObj(lifetime)
            return gson.toJson(obj)
        }
    }
}