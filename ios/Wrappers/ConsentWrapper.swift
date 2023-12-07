import Foundation
import XMTP

// Wrapper around XMTP.Conversation to allow passing these objects back into react native.
struct ConsentWrapper {
    static func encodeToObj(_ entry: XMTP.ConsentListEntry) throws -> [String: Any] {
        return [
            "type": entry.entryType,
            "value": entry.value,
            "state": consentStateToString(state: entry.consentType),
        ]
    }

    static func encode(_ entry: XMTP.ConsentListEntry) throws -> String {
        let obj = try encodeToObj(entry)
        let data = try JSONSerialization.data(withJSONObject: obj)
        guard let result = String(data: data, encoding: .utf8) else {
            throw WrapperError.encodeError("could not encode consent")
        }
        return result
    }
    
    static func consentStateToString(state: ConsentState) -> String {
        switch state {
            case .allowed: return "allowed"
            case .denied: return "denied"
            case .unknown: return "unknown"
        }
    }

}
