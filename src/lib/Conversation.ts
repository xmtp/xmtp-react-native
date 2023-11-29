import { DecodedMessage } from './DecodedMessage'
import * as XMTP from '../index'
import { ConversationContext, PreparedLocalMessage } from '../index'
export class Conversation {
  client: XMTP.Client
  createdAt: number
  context?: ConversationContext
  topic: string
  peerAddress: string
  version: string
  conversationID?: string | undefined

  constructor(
    client: XMTP.Client,
    params: {
      createdAt: number
      context?: ConversationContext
      topic: string
      peerAddress: string
      version: string
      conversationID?: string | undefined
    }
  ) {
    this.client = client
    this.createdAt = params.createdAt
    this.context = params.context
    this.topic = params.topic
    this.peerAddress = params.peerAddress
    this.version = params.version
    this.conversationID = params.conversationID
  }

  get clientAddress(): string {
    return this.client.address
  }

  async exportTopicData(): Promise<string> {
    return await XMTP.exportConversationTopicData(
      this.client.address,
      this.topic
    )
  }

  // TODO: Support pagination and conversation ID here
  async messages(
    limit?: number | undefined,
    before?: number | Date | undefined,
    after?: number | Date | undefined,
    direction?:
      | 'SORT_DIRECTION_ASCENDING'
      | 'SORT_DIRECTION_DESCENDING'
      | undefined
  ): Promise<DecodedMessage[]> {
    try {
      console.log('message() client is', this.client)

      const messages = await XMTP.listMessages(
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

  async sendWithJSCodec<T>(
    content: T,
    contentType: XMTP.ContentTypeId,
    client: XMTP.Client
  ): Promise<string> {
    const codec =
      client.codecRegistry[
        `${contentType.authorityId}/${contentType.typeId}:${contentType.versionMajor}.${contentType.versionMinor}`
      ]

    if (!codec) {
      throw new Error(`no codec found for: ${contentType}`)
    }

    return await XMTP.sendWithContentType(
      this.client.address,
      this.topic,
      content,
      codec
    )
  }

  // TODO: support conversation ID
  async send(content: any): Promise<string> {
    try {
      if (typeof content === 'string') {
        content = { text: content }
      }

      return await XMTP.sendMessage(this.client.address, this.topic, content)
    } catch (e) {
      console.info('ERROR in send()', e)
      throw e
    }
  }

  // Prepare the message to be sent.
  //
  // Instead of immediately `.send`ing a message, you can `.prepare` it first.
  // This yields a `PreparedLocalMessage` object, which you can send later.
  // This is useful to help construct a robust pending-message queue
  // that can survive connectivity outages and app restarts.
  //
  // Note: the sendPreparedMessage() method is available on both this `Conversation`
  //       or the top-level `Client` (when you don't have the `Conversation` handy).
  async prepareMessage(content: any): Promise<PreparedLocalMessage> {
    try {
      if (typeof content === 'string') {
        content = { text: content }
      }
      return await XMTP.prepareMessage(this.client.address, this.topic, content)
    } catch (e) {
      console.info('ERROR in prepareMessage()', e)
      throw e
    }
  }

  async sendPreparedMessage(prepared: PreparedLocalMessage): Promise<string> {
    try {
      return await XMTP.sendPreparedMessage(this.client.address, prepared)
    } catch (e) {
      console.info('ERROR in sendPreparedMessage()', e)
      throw e
    }
  }

  async decodeMessage(encryptedMessage: string): Promise<DecodedMessage> {
    try {
      return await XMTP.decodeMessage(
        this.client.address,
        this.topic,
        encryptedMessage
      )
    } catch (e) {
      console.info('ERROR in decodeMessage()', e)
      throw e
    }
  }

  async consentState(): Promise<'allowed' | 'denied' | 'unknown'> {
    return await XMTP.conversationConsentState(this.client.address, this.topic)
  }

  streamMessages(
    callback: (message: DecodedMessage) => Promise<void>
  ): () => void {
    XMTP.subscribeToMessages(this.client.address, this.topic)
    const hasSeen = {}
    XMTP.emitter.addListener(
      'message',
      async ({
        clientAddress,
        message,
      }: {
        clientAddress: string
        message: DecodedMessage
      }) => {
        if (clientAddress !== this.client.address) {
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

    return () => {
      XMTP.unsubscribeFromMessages(this.client.address, this.topic)
    }
  }
}
