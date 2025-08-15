package expo.modules.xmtpreactnativesdk.wrappers

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import org.xmtp.android.library.XMTPException
import org.xmtp.android.library.libxmtp.ArchiveElement
import org.xmtp.android.library.libxmtp.ArchiveMetadata

class ArchiveMetadataWrapper {
    companion object {
        val gson: Gson = GsonBuilder().create()
        private fun encodeToObj(metadata: ArchiveMetadata): Map<String, Any?> {
            return mapOf(
                "archiveVersion" to metadata.archiveVersion,
                "elements" to try {
                    metadata.elements.map { getArchiveElementString(it) }
                } catch (e: Exception) {
                    // By default we archive everything
                    arrayOf(ArchiveElement.MESSAGES, ArchiveElement.CONSENT)
                },
                "exportedAtNs" to metadata.exportedAtNs,
                "startNs" to metadata.startNs,
                "endNs" to metadata.endNs
            )
        }

        private fun getArchiveElementString(element: ArchiveElement): String {
            return when (element) {
                ArchiveElement.CONSENT -> "consent"
                ArchiveElement.MESSAGES -> "message"
                else -> throw XMTPException("Invalid archive element: $element")
            }
        }

        fun encode(metadata: ArchiveMetadata?): String {
            val obj = metadata?.let { encodeToObj(it) }
            return gson.toJson(obj)
        }
    }
}