import { Address, Client, InboxId } from './Client'
import { ConsentRecord, ConsentState } from './ConsentRecord'
import { EventTypes } from './types/EventTypes'
import * as XMTPModule from '../index'
import { ConversationId } from '../index'
import { getAddress } from '../utils/address'

export default class PrivatePreferences {
  client: Client<any>
  private subscriptions: { [key: string]: { remove: () => void } } = {}

  constructor(client: Client<any>) {
    this.client = client
  }

  async conversationConsentState(
    conversationId: ConversationId
  ): Promise<ConsentState> {
    return await XMTPModule.consentConversationIdState(
      this.client.installationId,
      conversationId
    )
  }

  async inboxIdConsentState(inboxId: InboxId): Promise<ConsentState> {
    return await XMTPModule.consentInboxIdState(
      this.client.installationId,
      inboxId
    )
  }

  async addressConsentState(address: Address): Promise<ConsentState> {
    return await XMTPModule.consentAddressState(
      this.client.installationId,
      getAddress(address)
    )
  }

  async setConsentState(consentRecord: ConsentRecord): Promise<void> {
    return await XMTPModule.setConsentState(
      this.client.installationId,
      consentRecord.value,
      consentRecord.entryType,
      consentRecord.state
    )
  }

  async syncConsent(): Promise<void> {
    return await XMTPModule.syncConsent(this.client.installationId)
  }

  /**
   * This method streams consent.
   * @returns {Promise<ConsentRecord[]>} A Promise that resolves to an array of ConsentRecord objects.
   */
  async streamConsent(
    callback: (consent: ConsentRecord) => Promise<void>
  ): Promise<void> {
    XMTPModule.subscribeToConsent(this.client.installationId)
    const subscription = XMTPModule.emitter.addListener(
      EventTypes.Consent,
      async ({
        installationId,
        consent,
      }: {
        installationId: string
        consent: ConsentRecord
      }) => {
        if (installationId !== this.client.installationId) {
          return
        }
        return await callback(
          new ConsentRecord(consent.value, consent.entryType, consent.state)
        )
      }
    )
    this.subscriptions[EventTypes.Consent] = subscription
  }

  /**
   * Cancels the stream for new consent records.
   */
  cancelStreamConsent() {
    if (this.subscriptions[EventTypes.Consent]) {
      this.subscriptions[EventTypes.Consent].remove()
      delete this.subscriptions[EventTypes.Consent]
    }
    XMTPModule.unsubscribeFromConsent(this.client.installationId)
  }
}
