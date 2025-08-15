import Foundation
import XMTP

// Wrapper around XMTP.ArchiveMetadata to allow passing these objects back into react native.
struct ArchiveMetadataWrapper {
    static func encodeToObj(_ metadata: XMTP.ArchiveMetadata) throws -> [String: Any] {
        return [
            "archiveVersion": metadata.archiveVersion,
            "elements": getArchiveElementStrings(metadata.elements),
            "exportedAtNs": metadata.exportedAtNs,
            "startNs": metadata.startNs,
            "endNs": metadata.endNs
        ]
    }
    
    private static func getArchiveElementStrings(_ elements: [XMTP.ArchiveElement]) -> [String] {
        do {
            return try elements.map { try getArchiveElementString($0) }
        } catch {
            // By default we archive everything
            return ["messages", "consent"]
        }
    }
    
    private static func getArchiveElementString(_ element: XMTP.ArchiveElement) throws -> String {
        switch element {
        case .messages:
            return "messages"
        case .consent:
            return "consent"
        default:
            throw WrapperError.encodeError("Invalid archive element: \(element)")
        }
    }
    
    static func encode(_ metadata: XMTP.ArchiveMetadata?) throws -> String {
        let obj: [String: Any]
        
        if let metadata = metadata {
            obj = try encodeToObj(metadata)
        } else {
            // Create default metadata object when null
            obj = [
                "archiveVersion": 0,
                "elements": ["messages", "consent"],
                "exportedAtNs": 0,
                "startNs": NSNull(),
                "endNs": NSNull()
            ]
        }
        
        let data = try JSONSerialization.data(withJSONObject: obj)
        guard let result = String(data: data, encoding: .utf8) else {
            throw WrapperError.encodeError("could not encode archive metadata")
        }
        return result
    }
}