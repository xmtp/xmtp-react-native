import { invitation } from '@xmtp/proto'
import { Buffer } from 'buffer'

import {
  ConversationVersion,
  ConversationContainer,
} from './ConversationContainer'
import { DecodedMessage } from './DecodedMessage'
import { ConversationSendPayload } from './types/ConversationCodecs'
import { DefaultContentTypes } from './types/DefaultContentType'
import { EventTypes } from './types/EventTypes'
import { SendOptions } from './types/SendOptions'
import * as XMTP from '../index'
import { ConversationContext, PreparedLocalMessage } from '../index'

export interface ConversationParams {
  createdAt: number
  context?: ConversationContext
  topic: string
  peerAddress?: string
  version: string
  conversationID?: string
  keyMaterial?: string
  consentProof?: string
}

export class Conversation<ContentTypes extends DefaultContentTypes>
  implements ConversationContainer<ContentTypes>
{
  client: XMTP.Client<ContentTypes>
  createdAt: number
  context?: ConversationContext
  topic: string
  peerAddress: string
  version = ConversationVersion.DIRECT
  conversationID?: string | undefined
  /**
   * Base64 encoded key material for the conversation.
   */
  keyMaterial?: string | undefined
  /**
   * Proof of consent for the conversation, used when a user is subscribing to broadcasts.
   */
  consentProof?: invitation.ConsentProofPayload | undefined

  constructor(client: XMTP.Client<ContentTypes>, params: ConversationParams) {
    this.client = client
    this.createdAt = params.createdAt
    this.context = params.context
    this.topic = params.topic
    this.peerAddress = params.peerAddress ?? ''
    this.conversationID = params.conversationID
    this.keyMaterial = params.keyMaterial
    try {
      if (params?.consentProof) {
        this.consentProof = invitation.ConsentProofPayload.decode(
          new Uint8Array(Buffer.from(params.consentProof, 'base64'))
        )
      }
    } catch {}
  }

  async exportTopicData(): Promise<string> {
    return await XMTP.exportConversationTopicData(
      this.client.inboxId,
      this.topic
    )
  }

  /**
   * Lists messages in a conversation with optional filters.
   *
   * @param {number} limit - Optional limit to the number of messages to return.
   * @param {number | Date} before - Optional timestamp to filter messages before.
   * @param {number | Date} after - Optional timestamp to filter messages after.
   * @param {"SORT_DIRECTION_ASCENDING" | "SORT_DIRECTION_DESCENDING"} direction - Optional sorting direction for messages.
   * @returns {Promise<DecodedMessage[]>} A Promise that resolves to an array of decoded messages.
   * @throws {Error} Throws an error if there is an issue with listing messages.
   *
   * @todo Support pagination and conversation ID in future implementations.
   */
  async messages(
    limit?: number | undefined,
    before?: number | Date | undefined,
    after?: number | Date | undefined,
    direction?:
      | 'SORT_DIRECTION_ASCENDING'
      | 'SORT_DIRECTION_DESCENDING'
      | undefined
  ): Promise<DecodedMessage<ContentTypes>[]> {
    try {
      const messages = await XMTP.listMessages<ContentTypes>(
        this.client,
        this.topic,
        limit,
        before,
        after,
        direction
      )

      return messages
    } catch (e) {
      console.info('ERROR in listMessages', e)
      return []
    }
  }

  private async _sendWithJSCodec<T>(
    content: T,
    contentType: XMTP.ContentTypeId
  ): Promise<string> {
    const codec =
      this.client.codecRegistry[
        `${contentType.authorityId}/${contentType.typeId}:${contentType.versionMajor}.${contentType.versionMinor}`
      ]

    if (!codec) {
      throw new Error(`no codec found for: ${contentType}`)
    }

    return await XMTP.sendWithContentType(
      this.client.inboxId,
      this.topic,
      content,
      codec
    )
  }

  /**
   * Sends a message to the current conversation.
   *
   * @param {string | MessageContent} content - The content of the message. It can be either a string or a structured MessageContent object.
   * @returns {Promise<string>} A Promise that resolves to a string identifier for the sent message.
   * @throws {Error} Throws an error if there is an issue with sending the message.
   *
   * @todo Support specifying a conversation ID in future implementations.
   */
  async send<SendContentTypes extends DefaultContentTypes = ContentTypes>(
    content: ConversationSendPayload<SendContentTypes>,
    opts?: SendOptions
  ): Promise<string> {
    if (opts && opts.contentType) {
      return await this._sendWithJSCodec(content, opts.contentType)
    }

    try {
      if (typeof content === 'string') {
        content = { text: content }
      }

      return await XMTP.sendMessage(this.client.inboxId, this.topic, content)
    } catch (e) {
      console.info('ERROR in send()', e)
      throw e
    }
  }

  private async _prepareWithJSCodec<T>(
    content: T,
    contentType: XMTP.ContentTypeId
  ): Promise<PreparedLocalMessage> {
    const codec =
      this.client.codecRegistry[
        `${contentType.authorityId}/${contentType.typeId}:${contentType.versionMajor}.${contentType.versionMinor}`
      ]

    if (!codec) {
      throw new Error(`no codec found for: ${contentType}`)
    }

    return await XMTP.prepareMessageWithContentType(
      this.client.inboxId,
      this.topic,
      content,
      codec
    )
  }

  /**
   * Prepares a message to be sent, yielding a `PreparedLocalMessage` object.
   *
   * Instead of immediately sending a message, you can prepare it first using this method.
   * This yields a `PreparedLocalMessage` object, which you can send later.
   * This is useful to help construct a robust pending-message queue
   * that can survive connectivity outages and app restarts.
   *
   * Note: the {@linkcode Conversation.sendPreparedMessage | sendPreparedMessage} method is available on both this {@linkcode Conversation}
   *       or the top-level `Client` (when you don't have the `Conversation` handy).
   *
   * @param {string | MessageContent} content - The content of the message. It can be either a string or a structured MessageContent object.
   * @returns {Promise<PreparedLocalMessage>} A Promise that resolves to a `PreparedLocalMessage` object.
   * @throws {Error} Throws an error if there is an issue with preparing the message.
   */
  async prepareMessage<
    PrepareContentTypes extends DefaultContentTypes = ContentTypes,
  >(
    content: ConversationSendPayload<PrepareContentTypes>,
    opts?: SendOptions
  ): Promise<PreparedLocalMessage> {
    if (opts && opts.contentType) {
      return await this._prepareWithJSCodec(content, opts.contentType)
    }
    try {
      if (typeof content === 'string') {
        content = { text: content }
      }
      return await XMTP.prepareMessage(this.client.inboxId, this.topic, content)
    } catch (e) {
      console.info('ERROR in prepareMessage()', e)
      throw e
    }
  }

  /**
   * Sends a prepared local message.
   *
   * This asynchronous method takes a `PreparedLocalMessage` and sends it.
   * Prepared messages are created using the {@linkcode Conversation.prepareMessage | prepareMessage} method.
   *
   * @param {PreparedLocalMessage} prepared - The prepared local message to be sent.
   * @returns {Promise<string>} A Promise that resolves to a string identifier for the sent message.
   * @throws {Error} Throws an error if there is an issue with sending the prepared message.
   */
  async sendPreparedMessage(prepared: PreparedLocalMessage): Promise<string> {
    try {
      return await XMTP.sendPreparedMessage(this.client.inboxId, prepared)
    } catch (e) {
      console.info('ERROR in sendPreparedMessage()', e)
      throw e
    }
  }

  /**
   * Decodes an encrypted message, yielding a `DecodedMessage` object.
   *
   * This asynchronous method takes an encrypted message and decodes it.
   * The result is a `DecodedMessage` object containing the decoded content and metadata.
   *
   * @param {string} encryptedMessage - The encrypted message to be decoded.
   * @returns {Promise<DecodedMessage>} A Promise that resolves to a `DecodedMessage` object.
   * @throws {Error} Throws an error if there is an issue with decoding the message.
   */
  async decodeMessage(
    encryptedMessage: string
  ): Promise<DecodedMessage<ContentTypes>> {
    try {
      return await XMTP.decodeMessage(
        this.client.inboxId,
        this.topic,
        encryptedMessage
      )
    } catch (e) {
      console.info('ERROR in decodeMessage()', e)
      throw e
    }
  }

  /**
   * Retrieves the consent state for the current conversation.
   *
   * This asynchronous method determine the consent state
   * for the current conversation, indicating whether the user has allowed, denied,
   * or is yet to provide consent.
   *
   * @returns {Promise<"allowed" | "denied" | "unknown">} A Promise that resolves to the consent state, which can be "allowed," "denied," or "unknown."
   */
  async consentState(): Promise<'allowed' | 'denied' | 'unknown'> {
    return await XMTP.conversationConsentState(this.client.inboxId, this.topic)
  }
  /**
   * Sets up a real-time message stream for the current conversation.
   *
   * This method subscribes to incoming messages in real-time and listens for new message events.
   * When a new message is detected, the provided callback function is invoked with the details of the message.
   * Additionally, this method returns a function that can be called to unsubscribe and end the message stream.
   *
   * @param {Function} callback - A callback function that will be invoked with the new DecodedMessage when a message is received.
   * @returns {Function} A function that, when called, unsubscribes from the message stream and ends real-time updates.
   */
  async streamMessages(
    callback: (message: DecodedMessage<ContentTypes>) => Promise<void>
  ): Promise<() => void> {
    await XMTP.subscribeToMessages(this.client.inboxId, this.topic)
    const hasSeen = {}
    const messageSubscription = XMTP.emitter.addListener(
      EventTypes.ConversationMessage,
      async ({
        inboxId,
        message,
        topic,
      }: {
        inboxId: string
        message: DecodedMessage<ContentTypes>
        topic: string
      }) => {
        // Long term these checks should be able to be done on the native layer as well, but additional checks in JS for safety
        if (inboxId !== this.client.inboxId) {
          return
        }
        if (topic !== this.topic) {
          return
        }
        if (hasSeen[message.id]) {
          return
        }

        hasSeen[message.id] = true

        message.client = this.client
        await callback(DecodedMessage.fromObject(message, this.client))
      }
    )

    return async () => {
      messageSubscription.remove()
      await XMTP.unsubscribeFromMessages(this.client.inboxId, this.topic)
    }
  }
}
