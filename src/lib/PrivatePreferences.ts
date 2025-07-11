import { Client, InboxId } from './Client'
import { ConsentRecord, ConsentState } from './ConsentRecord'
import * as XMTPModule from '../index'
import { ConversationId } from '../index'
import { EventTypes } from './types/EventTypes'

export type PreferenceUpdates = 'hmac_keys'

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

  async setConsentState(consentRecord: ConsentRecord): Promise<void> {
    return await XMTPModule.setConsentState(
      this.client.installationId,
      consentRecord.value,
      consentRecord.entryType,
      consentRecord.state
    )
  }

  async setConsentStates(consentRecords: ConsentRecord[]): Promise<void> {
    const recordStrings = consentRecords.map((record) => JSON.stringify(record))
    return await XMTPModule.setConsentStates(
      this.client.installationId,
      recordStrings
    )
  }

  /**
   * Syncs the local database between installations
   */
  async sync(): Promise<void> {
    return await XMTPModule.syncPreferences(this.client.installationId)
  }

  /**
   * @deprecated This method is deprecated. Use `sync()` instead.
   */
  async syncConsent(): Promise<void> {
    return await XMTPModule.syncConsent(this.client.installationId)
  }

  /**
   * This method streams private preference updates.
   * @param {Function} [onClose] - Optional callback to invoke when the stream is closed.
   * @returns {Promise<PreferenceUpdates[]>} A Promise that resolves to an array of PreferenceUpdates objects.
   */
  async streamPreferenceUpdates(
    callback: (preferenceUpdates: PreferenceUpdates) => Promise<void>,
    onClose?: () => void
  ): Promise<void> {
    XMTPModule.subscribeToPreferenceUpdates(this.client.installationId)
    const subscription = XMTPModule.emitter.addListener(
      EventTypes.PreferenceUpdates,
      async ({
        installationId,
        type,
      }: {
        installationId: string
        type: PreferenceUpdates
      }) => {
        if (installationId !== this.client.installationId) {
          return
        }
        return await callback(type)
      }
    )
    this.subscriptions[EventTypes.PreferenceUpdates] = subscription

    if (onClose) {
      const closedSubscription = XMTPModule.emitter.addListener(
        EventTypes.PreferenceUpdatesClosed,
        ({ installationId }: { installationId: string }) => {
          if (installationId !== this.client.installationId) {
            return
          }

          onClose()
        }
      )
      this.subscriptions[EventTypes.PreferenceUpdatesClosed] =
        closedSubscription
    }
  }

  /**
   * This method streams consent.
   * @param {Function} [onClose] - Optional callback to invoke when the stream is closed.
   * @returns {Promise<ConsentRecord[]>} A Promise that resolves to an array of ConsentRecord objects.
   */
  async streamConsent(
    callback: (consent: ConsentRecord) => Promise<void>,
    onClose?: () => void
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

    if (onClose) {
      const closedSubscription = XMTPModule.emitter.addListener(
        EventTypes.ConsentClosed,
        ({ installationId }: { installationId: string }) => {
          if (installationId !== this.client.installationId) {
            return
          }

          onClose()
        }
      )
      this.subscriptions[EventTypes.ConsentClosed] = closedSubscription
    }
  }

  /**
   * Cancels the stream for new consent records.
   */
  cancelStreamConsent() {
    if (this.subscriptions[EventTypes.Consent]) {
      this.subscriptions[EventTypes.Consent].remove()
      delete this.subscriptions[EventTypes.Consent]
    }
    if (this.subscriptions[EventTypes.ConsentClosed]) {
      this.subscriptions[EventTypes.ConsentClosed].remove()
      delete this.subscriptions[EventTypes.ConsentClosed]
    }
    XMTPModule.unsubscribeFromConsent(this.client.installationId)
  }

  /**
   * Cancels the stream for preference updates.
   */
  cancelStreamPreferenceUpdates() {
    if (this.subscriptions[EventTypes.PreferenceUpdates]) {
      this.subscriptions[EventTypes.PreferenceUpdates].remove()
      delete this.subscriptions[EventTypes.PreferenceUpdates]
    }
    if (this.subscriptions[EventTypes.PreferenceUpdatesClosed]) {
      this.subscriptions[EventTypes.PreferenceUpdatesClosed].remove()
      delete this.subscriptions[EventTypes.PreferenceUpdatesClosed]
    }
    XMTPModule.unsubscribeFromPreferenceUpdates(this.client.installationId)
  }
}
