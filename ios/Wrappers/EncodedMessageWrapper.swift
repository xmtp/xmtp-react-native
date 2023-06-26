//
//  EncodedMessageWrapper.swift
//

import Foundation
import XMTP

// Wrapper around XMTP.EncodedMessage to allow passing these objects back
// into react native.
struct EncodedMessageWrapper: BinaryDataWrapper {
	static func wrap(model: XMTP.DecodedMessage) -> EncodedMessageWrapper {
		EncodedMessageWrapper(
			id: model.id,
			content: (try? model.content()) ?? model.fallbackContent,
			senderAddress: model.senderAddress,
			sent: model.sent
		)
	}

	var id: String
	var content: String
	var senderAddress: String
	var sent: Date
}
