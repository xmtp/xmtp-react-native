package expo.modules.xmtpreactnativesdk.wrappers

import android.util.Base64
import com.google.gson.GsonBuilder
import org.xmtp.android.library.libxmtp.AvailableArchive

class AvailableArchiveWrapper {
    companion object {
        private val gson = GsonBuilder().create()

        fun encodeToObj(archive: AvailableArchive): Map<String, Any> = mapOf(
            "pin" to archive.pin,
            "metadata" to ArchiveMetadataWrapper.encode(archive.metadata),
            "sentByInstallation" to Base64.encodeToString(archive.sentByInstallation, Base64.NO_WRAP),
        )

        fun encodeList(archives: List<AvailableArchive>): String {
            val list = archives.map { encodeToObj(it) }
            return gson.toJson(list)
        }
    }
}
