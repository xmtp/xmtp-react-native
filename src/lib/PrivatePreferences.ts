import { Client, InboxId } from './Client'
import { ConsentListEntry, ConsentState } from './ConsentListEntry'
import * as XMTPModule from '../index'
import { ConversationId } from '../index'
import { Address, getAddress } from '../utils/address'

export default class PrivatePreferences {
  client: Client<any>

  constructor(client: Client<any>) {
    this.client = client
  }

  async consentConversationIdState(
    conversationId: ConversationId
  ): Promise<ConsentState> {
    return await XMTPModule.consentConversationIdState(
      this.client.inboxId,
      conversationId
    )
  }

  async consentInboxIdState(inboxId: InboxId): Promise<ConsentState> {
    return await XMTPModule.consentInboxIdState(this.client.inboxId, inboxId)
  }

  async consentAddressState(address: Address): Promise<ConsentState> {
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
}
