import Foundation
import XMTP

// Wrapper around XMTP.ConversationDebugInfo to allow passing these objects back into react native.
struct ConversationDebugInfoWrapper {
    static func encodeToObj(_ info: XMTP.ConversationDebugInfo) throws -> [String: Any] {
        return [
            "epoch": info.epoch,
            "maybeForked": info.maybeForked,
            "forkDetails": info.forkDetails,
        ]
    }
    
    static func encode(_ info: XMTP.ConversationDebugInfo) throws -> String {
        let obj = try encodeToObj(info)
        let data = try JSONSerialization.data(withJSONObject: obj)
        guard let result = String(data: data, encoding: .utf8) else {
            throw WrapperError.encodeError("could not encode conversation debug info")
        }
        return result
    }
}
