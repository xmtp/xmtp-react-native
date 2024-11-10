import { keccak_256 } from '@noble/hashes/sha3'
import { TextEncoder } from 'text-encoding'

const addressRegex = /^0x[a-fA-F0-9]{40}$/
const encoder = new TextEncoder()

export function stringToBytes(value: string): Uint8Array {
  const bytes = encoder.encode(value)
  return bytes
}

export function keccak256(value: Uint8Array): Uint8Array {
  const bytes = keccak_256(value)
  return bytes
}

export function isAddress(address: string): boolean {
  return addressRegex.test(address)
}

export function checksumAddress(address_: string, chainId?: number): string {
  const hexAddress = chainId
    ? `${chainId}${address_.toLowerCase()}`
    : address_.substring(2).toLowerCase()
  const hash = keccak256(stringToBytes(hexAddress))

  const address = (
    chainId ? hexAddress.substring(`${chainId}0x`.length) : hexAddress
  ).split('')
  for (let i = 0; i < 40; i += 2) {
    if (hash[i >> 1] >> 4 >= 8 && address[i]) {
      address[i] = address[i].toUpperCase()
    }
    if ((hash[i >> 1] & 0x0f) >= 8 && address[i + 1]) {
      address[i + 1] = address[i + 1].toUpperCase()
    }
  }

  return `0x${address.join('')}`
}

const addressCache = new Map<string, string>()

export function getAddress(address: string, chainId?: number): string {
  if (addressCache.has(address)) return addressCache.get(address) as string
  if (!isAddress(address)) throw new Error('Invalid address' + address)
  const checksumedAddress = checksumAddress(address, chainId)
  addressCache.set(address, checksumedAddress)
  return checksumedAddress
}
