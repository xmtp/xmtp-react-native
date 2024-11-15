import { Address, Client, InboxId } from './Client'
import { ConsentListEntry, ConsentState } from './ConsentListEntry'
import * as XMTPModule from '../index'
import { ConversationId } from '../index'
import { getAddress } from '../utils/address'

export default class PrivatePreferences {
  client: Client<any>

  constructor(client: Client<any>) {
    this.client = client
  }

  async conversationConsentState(
    conversationId: ConversationId
  ): Promise<ConsentState> {
    return await XMTPModule.consentConversationIdState(
      this.client.inboxId,
      conversationId
    )
  }

  async inboxIdConsentState(inboxId: InboxId): Promise<ConsentState> {
    return await XMTPModule.consentInboxIdState(this.client.inboxId, inboxId)
  }

  async addressConsentState(address: Address): Promise<ConsentState> {
    return await XMTPModule.consentAddressState(
      this.client.inboxId,
      getAddress(address)
    )
  }

  async setConsentState(consentEntry: ConsentListEntry): Promise<void> {
    return await XMTPModule.setConsentState(
      this.client.inboxId,
      consentEntry.value,
      consentEntry.entryType,
      consentEntry.permissionType
    )
  }

  async syncConsent(): Promise<void> {
    return await XMTPModule.syncConsent(this.client.inboxId)
  }
}
