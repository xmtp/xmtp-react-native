import { Client } from './Client'
import { ConsentListEntry } from './ConsentListEntry'
import * as XMTPModule from '../index'

export default class Contacts {
  client: Client<any>

  constructor(client: Client<any>) {
    this.client = client
  }

  async isAllowed(address: string): Promise<boolean> {
    return await XMTPModule.isAllowed(this.client.address, address)
  }

  async isDenied(address: string): Promise<boolean> {
    return await XMTPModule.isDenied(this.client.address, address)
  }

  deny(addresses: string[]) {
    XMTPModule.denyContacts(this.client.address, addresses)
  }

  allow(addresses: string[]) {
    XMTPModule.allowContacts(this.client.address, addresses)
  }

  async refreshConsentList(): Promise<ConsentListEntry[]> {
    return await XMTPModule.refreshConsentList(this.client.address)
  }

  async consentList(): Promise<ConsentListEntry[]> {
    return await XMTPModule.consentList(this.client.address)
  }
}
