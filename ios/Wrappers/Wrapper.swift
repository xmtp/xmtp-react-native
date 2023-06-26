//
//  Wrapper.swift
//
//  Created by Pat Nakajima on 4/21/23.
//

import Foundation
import MessagePack

enum WrapperError: Swift.Error {
	case encodeError(String)
}

protocol Wrapper: Codable {
	associatedtype T
	static func wrap(model: T) -> Self
}

extension Wrapper {
	static func encode(_ model: T) throws -> String {
		let wrapper = wrap(model: model)
		let data = try JSONEncoder().encode(wrapper)

		guard let result = String(data: data, encoding: .utf8) else {
			throw WrapperError.encodeError("could not encode \(model)")
		}

        let msgpackData = try MessagePackEncoder().encode(wrapper)
		print("MSG PACK DATA", msgpackData)
		return result
	}
}
