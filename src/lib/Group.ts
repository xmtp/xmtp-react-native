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

export class Group<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> implements ConversationContainer<ContentTypes>
{
  client: XMTP.Client<ContentTypes>
  id: string
  createdAt: number
  peerAddresses: string[]
  version = ConversationVersion.GROUP
  topic: string
  adminAddress: string
  permissionLevel: 'everyone_admin' | 'creator_admin'

  constructor(
    client: XMTP.Client<ContentTypes>,
    params: {
      id: string
      createdAt: number
      peerAddresses: string[]
      adminAddress: string
      permissionLevel: 'everyone_admin' | 'creator_admin'
      topic: string
    }
  ) {
    this.client = client
    this.id = params.id
    this.createdAt = params.createdAt
    this.peerAddresses = params.peerAddresses
    this.topic = params.topic
    this.adminAddress = params.adminAddress
    this.permissionLevel = params.permissionLevel
  }

  get clientAddress(): string {
    return this.client.address
  }

  /**
   * This method returns an array of addresses associated with the group.
   *
   * @param {boolean} skipSync - Optional flag to skip syncing members with the network before returning. Defaults to false.
   * If skipSync set to true, the method will return the array of member addresses already known from the last network sync.
   * Setting skipSync to true is an optional optimization to immediately return all members without
   * fetching from the network first. This is useful for clients who prefer to manage syncing logic themselves via the sync() method.
   * @returns {Promise<DecodedMessage<ContentTypes>[]>} A Promise that resolves to an array of DecodedMessage objects.
   */
  async memberAddresses(skipSync: boolean = false): Promise<string[]> {
    if (!skipSync) {
      await this.sync()
    }
    return XMTP.listMemberAddresses(this.client, this.id)
  }

  /**
   * Sends a message to the current group.
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
    // TODO: Enable other content types
    // if (opts && opts.contentType) {
    // return await this._sendWithJSCodec(content, opts.contentType)
    // }

    try {
      if (typeof content === 'string') {
        content = { text: content }
      }

      return await XMTP.sendMessageToGroup(
        this.client.address,
        this.id,
        content
      )
    } catch (e) {
      console.info('ERROR in send()', e.message)
      throw e
    }
  }

  /**
   * This method returns an array of messages associated with the group.
   *
   * @param {boolean} skipSync - Optional flag to skip syncing messages with the network before returning. Defaults to false.
   * If skipSync set to true, the method will return the array of messages already known from the last network sync.
   * Setting skipSync to true is an optional optimization to immediately return all messages without
   * fetching from the network first. This is useful for clients who prefer to manage syncing logic themselves via the sync() method.
   * @param {number | undefined} limit - Optional maximum number of messages to return.
   * @param {number | Date | undefined} before - Optional filter for specifying the maximum timestamp of messages to return.
   * @param {number | Date | undefined} after - Optional filter for specifying the minimum timestamp of messages to return.
   * @param direction - Optional parameter to specify the time ordering of the messages to return.
   * @returns {Promise<DecodedMessage<ContentTypes>[]>} A Promise that resolves to an array of DecodedMessage objects.
   */
  async messages(
    skipSync: boolean = false,
    limit?: number | undefined,
    before?: number | Date | undefined,
    after?: number | Date | undefined,
    direction?:
      | 'SORT_DIRECTION_ASCENDING'
      | 'SORT_DIRECTION_DESCENDING'
      | undefined
  ): Promise<DecodedMessage<ContentTypes>[]> {
    if (!skipSync) {
      await this.sync()
    }
    return await XMTP.groupMessages(
      this.client,
      this.id,
      limit,
      before,
      after,
      direction
    )
  }

  /**
   * Executes a network request to fetch the latest messages and membership changes
   * associated with the group and saves them to the local state.
   */
  async sync() {
    await XMTP.syncGroup(this.client.address, this.id)
  }

  /**
   * Sets up a real-time message stream for the current group.
   *
   * This method subscribes to incoming messages in real-time and listens for new message events.
   * When a new message is detected, the provided callback function is invoked with the details of the message.
   * Additionally, this method returns a function that can be called to unsubscribe and end the message stream.
   *
   * @param {Function} callback - A callback function that will be invoked with the new DecodedMessage when a message is received.
   * @returns {Function} A function that, when called, unsubscribes from the message stream and ends real-time updates.
   */
  async streamGroupMessages(
    callback: (message: DecodedMessage<ContentTypes>) => Promise<void>
  ): Promise<() => void> {
    await XMTP.subscribeToGroupMessages(this.client.address, this.id)
    const hasSeen = {}
    const messageSubscription = XMTP.emitter.addListener(
      EventTypes.GroupMessage,
      async ({
        clientAddress,
        message,
        groupId,
      }: {
        clientAddress: string
        message: DecodedMessage<ContentTypes>
        groupId: string
      }) => {
        // Long term these checks should be able to be done on the native layer as well, but additional checks in JS for safety
        if (clientAddress !== this.client.address) {
          return
        }
        if (groupId !== this.id) {
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
      await XMTP.unsubscribeFromGroupMessages(this.client.address, this.id)
    }
  }

  async addMembers(addresses: string[]): Promise<void> {
    return XMTP.addGroupMembers(this.client.address, this.id, addresses)
  }

  async removeMembers(addresses: string[]): Promise<void> {
    return XMTP.removeGroupMembers(this.client.address, this.id, addresses)
  }

  async isActive(skipSync = false): Promise<boolean> {
    if (!skipSync) {
      await this.sync()
    }
    return XMTP.isGroupActive(this.client.address, this.id)
  }

  addedByAddress(): Promise<string> {
    return XMTP.addedByAddress(this.client.address, this.id)
  }

  async isAdmin(): Promise<boolean> {
    return XMTP.isGroupAdmin(this.client.address, this.id)
  }

  async processMessage(
    encryptedMessage: string
  ): Promise<DecodedMessage<ContentTypes>> {
    try {
      return await XMTP.processGroupMessage(
        this.client,
        this.id,
        encryptedMessage
      )
    } catch (e) {
      console.info('ERROR in processGroupMessage()', e)
      throw e
    }
  }

  async consentState(): Promise<'allowed' | 'denied' | 'unknown'> {
    return await XMTP.groupConsentState(this.clientAddress, this.id)
  }
}
