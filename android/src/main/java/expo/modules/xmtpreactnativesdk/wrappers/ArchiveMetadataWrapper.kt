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
                    listOf("message", "consent")
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

        /** Returns metadata as a map for embedding in another JSON object (avoids double JSON encoding). */
        fun encodeToMap(metadata: ArchiveMetadata?): Map<String, Any?> {
            return if (metadata != null) {
                encodeToObj(metadata)
            } else {
                mapOf(
                    "archiveVersion" to 0u,
                    "elements" to listOf("messages", "consent"),
                    "exportedAtNs" to 0L,
                    "startNs" to null,
                    "endNs" to null
                )
            }
        }

        fun encode(metadata: ArchiveMetadata?): String {
            return gson.toJson(encodeToMap(metadata))
        }
    }
}
