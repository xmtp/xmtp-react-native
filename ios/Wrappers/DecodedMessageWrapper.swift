//
//  DecodedMessageWrapper.swift
//
//  Created by Pat Nakajima on 4/22/23.
//

import Foundation
import XMTP

// Wrapper around XMTP.DecodedMessage to allow passing these objects back
// into react native.
struct DecodedMessageWrapper: Wrapper {
	static func wrap(model: XMTP.DecodedMessage) -> DecodedMessageWrapper {
		DecodedMessageWrapper(
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
