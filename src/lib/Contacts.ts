import { Client } from './Client'
import { ConsentListEntry } from './ConsentListEntry'
import * as XMTPModule from '../index'
import { getAddress } from '../utils/address'

export default class Contacts {
  client: Client<any>

  constructor(client: Client<any>) {
    this.client = client
  }

  async isAllowed(address: string): Promise<boolean> {
    return await XMTPModule.isAllowed(this.client.address, getAddress(address))
  }

  async isDenied(address: string): Promise<boolean> {
    return await XMTPModule.isDenied(this.client.address, getAddress(address))
  }

  async deny(addresses: string[]): Promise<void> {
    const checkSummedAddresses = addresses.map((address) => getAddress(address))
    return await XMTPModule.denyContacts(
      this.client.address,
      checkSummedAddresses
    )
  }

  async allow(addresses: string[]): Promise<void> {
    const checkSummedAddresses = addresses.map((address) => getAddress(address))
    return await XMTPModule.allowContacts(
      this.client.address,
      checkSummedAddresses
    )
  }

  async refreshConsentList(): Promise<ConsentListEntry[]> {
    return await XMTPModule.refreshConsentList(this.client.address)
  }

  async consentList(): Promise<ConsentListEntry[]> {
    return await XMTPModule.consentList(this.client.address)
  }
}
