import { Client, InboxId } from './Client'
import { ConsentListEntry } from './ConsentListEntry'
import * as XMTPModule from '../index'
import { getAddress } from '../utils/address'

export default class Contacts {
  client: Client<any>

  constructor(client: Client<any>) {
    this.client = client
  }

  async isAllowed(address: string): Promise<boolean> {
    return await XMTPModule.isAllowed(this.client.inboxId, getAddress(address))
  }

  async isDenied(address: string): Promise<boolean> {
    return await XMTPModule.isDenied(this.client.inboxId, getAddress(address))
  }

  async deny(addresses: string[]): Promise<void> {
    const checkSummedAddresses = addresses.map((address) => getAddress(address))
    return await XMTPModule.denyContacts(
      this.client.inboxId,
      checkSummedAddresses
    )
  }

  async allow(addresses: string[]): Promise<void> {
    const checkSummedAddresses = addresses.map((address) => getAddress(address))
    return await XMTPModule.allowContacts(
      this.client.inboxId,
      checkSummedAddresses
    )
  }

  async refreshConsentList(): Promise<ConsentListEntry[]> {
    return await XMTPModule.refreshConsentList(this.client.inboxId)
  }

  async consentList(): Promise<ConsentListEntry[]> {
    return await XMTPModule.consentList(this.client.inboxId)
  }

  async allowGroups(groupIds: string[]): Promise<void> {
    return await XMTPModule.allowGroups(this.client.inboxId, groupIds)
  }

  async denyGroups(groupIds: string[]): Promise<void> {
    return await XMTPModule.denyGroups(this.client.inboxId, groupIds)
  }

  async isGroupAllowed(groupId: string): Promise<boolean> {
    return await XMTPModule.isGroupAllowed(this.client.inboxId, groupId)
  }

  async isGroupDenied(groupId: string): Promise<boolean> {
    return await XMTPModule.isGroupDenied(this.client.inboxId, groupId)
  }

  async allowInboxes(inboxIds: InboxId[]): Promise<void> {
    return await XMTPModule.allowInboxes(this.client.inboxId, inboxIds)
  }

  async denyInboxes(inboxIds: InboxId[]): Promise<void> {
    return await XMTPModule.denyInboxes(this.client.inboxId, inboxIds)
  }

  async isInboxAllowed(inboxId: InboxId): Promise<boolean> {
    return await XMTPModule.isInboxAllowed(this.client.inboxId, inboxId)
  }

  async isInboxDenied(inboxId: InboxId): Promise<boolean> {
    return await XMTPModule.isInboxDenied(this.client.inboxId, inboxId)
  }
}
