import {
  ConversationVersion,
  ConversationContainer,
} from './ConversationContainer'
import { DecodedMessage, MessageDeliveryStatus } from './DecodedMessage'
import { ConversationSendPayload } from './types/ConversationCodecs'
import { DefaultContentTypes } from './types/DefaultContentType'
import { EventTypes } from './types/EventTypes'
import { MessagesOptions } from './types/MessagesOptions'
import { SendOptions } from './types/SendOptions'
import * as XMTP from '../index'

export class Group<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> implements ConversationContainer<ContentTypes>
{
  client: XMTP.Client<ContentTypes>
  id: string
  createdAt: number
  peerInboxIds: string[]
  version = ConversationVersion.GROUP
  topic: string
  creatorInboxId: string
  permissionLevel: 'all_members' | 'admin_only'
  name: string
  isGroupActive: boolean

  constructor(
    client: XMTP.Client<ContentTypes>,
    params: {
      id: string
      createdAt: number
      peerInboxIds: string[]
      creatorInboxId: string
      permissionLevel: 'all_members' | 'admin_only'
      topic: string
      name: string
      isGroupActive: boolean
    }
  ) {
    this.client = client
    this.id = params.id
    this.createdAt = params.createdAt
    this.peerInboxIds = params.peerInboxIds
    this.topic = params.topic
    this.creatorInboxId = params.creatorInboxId
    this.permissionLevel = params.permissionLevel
    this.name = params.name
    this.isGroupActive = params.isGroupActive
  }

  get clientAddress(): string {
    return this.client.address
  }

  /**
   * This method returns an array of addresses associated with the group.
   * To get the latest member addresses from the network, call sync() first.
   * @returns {Promise<DecodedMessage<ContentTypes>[]>} A Promise that resolves to an array of DecodedMessage objects.
   */
  async memberInboxIds(): Promise<string[]> {
    return XMTP.listMemberInboxIds(this.client, this.id)
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
   * To get the latest messages from the network, call sync() first.
   *
   * @param {number | undefined} limit - Optional maximum number of messages to return.
   * @param {number | Date | undefined} before - Optional filter for specifying the maximum timestamp of messages to return.
   * @param {number | Date | undefined} after - Optional filter for specifying the minimum timestamp of messages to return.
   * @param direction - Optional parameter to specify the time ordering of the messages to return.
   * @returns {Promise<DecodedMessage<ContentTypes>[]>} A Promise that resolves to an array of DecodedMessage objects.
   */
  async messages(
    opts?: MessagesOptions
  ): Promise<DecodedMessage<ContentTypes>[]> {
    return await XMTP.groupMessages(
      this.client,
      this.id,
      opts?.limit,
      opts?.before,
      opts?.after,
      opts?.direction,
      opts?.deliveryStatus ?? MessageDeliveryStatus.ALL
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

  async addMembersByInboxId(inboxIds: string[]): Promise<void> {
    return XMTP.addGroupMembersByInboxId(this.client.address, this.id, inboxIds)
  }

  async removeMembersByInboxId(inboxIds: string[]): Promise<void> {
    return XMTP.removeGroupMembersByInboxId(
      this.client.address,
      this.id,
      inboxIds
    )
  }

  // Returns the group name.
  // To get the latest group name from the network, call sync() first.
  async groupName(): Promise<string> {
    return XMTP.groupName(this.client.address, this.id)
  }

  async updateGroupName(groupName: string): Promise<void> {
    return XMTP.updateGroupName(this.client.address, this.id, groupName)
  }

  // Returns whether the group is active.
  // To get the latest active status from the network, call sync() first.
  async isActive(): Promise<boolean> {
    return XMTP.isGroupActive(this.client.address, this.id)
  }

  // Returns the address that added you to the group.
  // To get the latest added by address from the network, call sync() first.
  async addedByInboxId(): Promise<string> {
    return XMTP.addedByInboxId(this.client.address, this.id)
  }

  // Returns whether you are an admin of the group.
  // To get the latest admin status from the network, call sync() first.
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

  async isAllowed(): Promise<boolean> {
    return await XMTP.isGroupAllowed(this.client.address, this.id)
  }

  async isDenied(): Promise<boolean> {
    return await XMTP.isGroupDenied(this.client.address, this.id)
  }
}
