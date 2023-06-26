//
//  BinaryDataWrapper.swift
//


import Foundation
import MessagePacker

enum BinaryDataWrapperError: Swift.Error {
	case encodeError(String)
}

protocol BinaryDataWrapper: Codable {
	associatedtype T
	static func wrap(model: T) -> Self
}

extension BinaryDataWrapper {
  static func encode(_ model: T) throws -> [UInt8] {
    let wrapper = wrap(model: model)
	let encodedData = try MessagePackEncoder().encode(wrapper)
    return [UInt8](encodedData)
  }
}
