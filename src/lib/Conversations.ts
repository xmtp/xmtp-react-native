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

  /**
   * This method returns a list of all conversations that the client is a member of.
   *
   * @returns {Promise<Conversation[]>} A Promise that resolves to an array of Conversation objects.
   */
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
  /**
   * Creates a new conversation.
   *
   * This method creates a new conversation with the specified peer address and context.
   *
   * @param {string} peerAddress - The address of the peer to create a conversation with.
   * @param {ConversationContext} context - Optional context to associate with the conversation.
   * @returns {Promise<Conversation>} A Promise that resolves to a Conversation object.
   */
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

  /**
   * Sets up a real-time stream to listen for new conversations being started.
   *
   * This method subscribes to conversations in real-time and listens for incoming conversation events.
   * When a new conversation is detected, the provided callback function is invoked with the details of the conversation.
   * @param {Function} callback - A callback function that will be invoked with the new Conversation when a conversation is started.
   * @returns {Promise<void>} A function that, when called, unsubscribes from the message stream and ends real-time updates..
   */
  async stream(
    callback: (conversation: Conversation<ContentTypes>) => Promise<void>
  ): Promise<() => void> {
    XMTPModule.subscribeToConversations(this.client.address)
    const conversationSubscription = XMTPModule.emitter.addListener(
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
    return () => {
      conversationSubscription.remove()
      XMTPModule.unsubscribeFromConversations(this.client.address)
    }
  }

  /**
   * Listen for new messages in all conversations.
   *
   * This method subscribes to all conversations in real-time and listens for incoming and outgoing messages.
   * @param {Function} callback - A callback function that will be invoked when a message is sent or received.
   * @returns {Promise<void>} A function that, when called, unsubscribes from all the messages stream and ends real-time updates.
   */
  async streamAllMessages(
    callback: (message: DecodedMessage) => Promise<void>
  ): Promise<() => void> {
    XMTPModule.subscribeToAllMessages(this.client.address)
    const messagesSubscription = XMTPModule.emitter.addListener(
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
    return () => {
      messagesSubscription.remove()
      XMTPModule.unsubscribeFromAllMessages(this.client.address)
    }
  }
}
