//
//  EncodedMessageWrapper.swift
//

import Foundation
import XMTP

// Wrapper around XMTP.EncodedMessage to allow passing these objects back
// into react native.
struct EncodedMessageWrapper: BinaryDataWrapper {
	static func wrap(model: XMTP.DecodedMessage) throws -> EncodedMessageWrapper {
		EncodedMessageWrapper(
			id: model.id,
            content: [UInt8](try model.encodedContent.serializedData()),
			senderAddress: model.senderAddress,
			sent: model.sent
		)
	}

	var id: String
	var content: [UInt8]
	var senderAddress: String
	var sent: Date
}
