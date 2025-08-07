package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import org.xmtp.android.library.XMTPException

class ArchiveMetadataWrapper {
    companion object {
        val gson: Gson = GsonBuilder().create()
        private fun encodeToObj(metadata: ArchiveMetadata?): Map<String, Any> {
            return mapOf(
                "archiveVersion" to metadata.archiveVersion,
                "elements" to metadata.elements.map { getArchiveElementString(it) },
                "exportedAtNs" to metadata.exportedAtNs,
                "startNs" to metadata.startedNs,
                "endNs" to metadata.endNs
            )
        }

        fun encode(lifetime: FfiLifetime?): String {
            val obj = encodeToObj(lifetime)
            return gson.toJson(obj)
        }
    }

    private fun getArchiveElementString(element: ArchiveElement): String {
        return when (element) {
            ArchiveElement.CONSENT -> "consent"
            ArchiveElement.MESSAGE -> "message"
            else -> throw XMTPException("Invalid archive element: $element")
        }
    }
}