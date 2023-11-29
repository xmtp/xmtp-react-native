import { Client } from './Client'
import { Conversation } from './Conversation'
import { DecodedMessage } from './DecodedMessage'
import { ConversationContext } from '../XMTP.types'
import * as XMTPModule from '../index'

export default class Conversations<ContentTypes> {
  client: Client<ContentTypes>
  private known = {} as { [topic: string]: boolean }

  constructor(client: Client<ContentTypes>) {
    this.client = client
  }

  async list(): Promise<Conversation<ContentTypes>[]> {
    const result = await XMTPModule.listConversations(this.client)

    for (const conversation of result) {
      this.known[conversation.topic] = true
    }

    return result
  }

  async importTopicData(
    topicData: string
  ): Promise<Conversation<ContentTypes>> {
    const conversation = await XMTPModule.importConversationTopicData(
      this.client,
      topicData
    )
    this.known[conversation.topic] = true
    return conversation
  }

  async newConversation(
    peerAddress: string,
    context?: ConversationContext
  ): Promise<Conversation<ContentTypes>> {
    return await XMTPModule.createConversation(
      this.client,
      peerAddress,
      context
    )
  }

  async stream(
    callback: (conversation: Conversation<ContentTypes>) => Promise<void>
  ) {
    XMTPModule.subscribeToConversations(this.client.address)
    XMTPModule.emitter.addListener(
      'conversation',
      async ({
        clientAddress,
        conversation,
      }: {
        clientAddress: string
        conversation: Conversation<ContentTypes>
      }) => {
        if (clientAddress !== this.client.address) {
          return
        }
        if (this.known[conversation.topic]) {
          return
        }

        this.known[conversation.topic] = true
        await callback(new Conversation(this.client, conversation))
      }
    )
  }

  async streamAllMessages(
    callback: (message: DecodedMessage) => Promise<void>
  ) {
    XMTPModule.subscribeToAllMessages(this.client.address)
    XMTPModule.emitter.addListener(
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
        if (this.known[message.id]) {
          return
        }

        this.known[message.id] = true
        await callback(DecodedMessage.fromObject(message, this.client))
      }
    )
  }

  cancelStream() {
    XMTPModule.unsubscribeFromConversations(this.client.address)
  }

  cancelStreamAllMessages() {
    XMTPModule.unsubscribeFromAllMessages(this.client.address)
  }
}
