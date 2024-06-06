import {
  ConversationVersion,
  ConversationContainer,
} from './ConversationContainer'
import { DecodedMessage, MessageDeliveryStatus } from './DecodedMessage'
import { Member } from './Member'
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
   * This method returns an array of inbox ids associated with the group.
   * To get the latest member inbox ids from the network, call sync() first.
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

  /**
   *
   * @param addresses addresses to add to the group
   * @returns
   */
  async addMembers(addresses: string[]): Promise<void> {
    return XMTP.addGroupMembers(this.client.address, this.id, addresses)
  }

  /**
   *
   * @param addresses addresses to remove from the group
   * @returns
   */
  async removeMembers(addresses: string[]): Promise<void> {
    return XMTP.removeGroupMembers(this.client.address, this.id, addresses)
  }

  /**
   *
   * @param inboxIds inboxIds to add to the group
   * @returns
   */
  async addMembersByInboxId(inboxIds: string[]): Promise<void> {
    return XMTP.addGroupMembersByInboxId(this.client.address, this.id, inboxIds)
  }

  /**
   *
   * @param inboxIds inboxIds to remove from the group
   * @returns
   */
  async removeMembersByInboxId(inboxIds: string[]): Promise<void> {
    return XMTP.removeGroupMembersByInboxId(
      this.client.address,
      this.id,
      inboxIds
    )
  }

  /**
   * Returns the group name.
   * To get the latest group name from the network, call sync() first.
   * @returns {string} A Promise that resolves to the group name.
   */
  async groupName(): Promise<string> {
    return XMTP.groupName(this.client.address, this.id)
  }

  /**
   * Updates the group name.
   * Will throw if the user does not have the required permissions.
   * @param {string} groupName new group name
   * @returns
   */

  async updateGroupName(groupName: string): Promise<void> {
    return XMTP.updateGroupName(this.client.address, this.id, groupName)
  }

  /**
   * Returns whether the group is active.
   * To get the latest active status from the network, call sync() first
   * @returns {Promise<boolean>} A Promise that resolves if the group is active or not
   */

  async isActive(): Promise<boolean> {
    return XMTP.isGroupActive(this.client.address, this.id)
  }

  /**
   * Returns the inbox id that added you to the group.
   * To get the latest added by inbox id from the network, call sync() first.
   * @returns {Promise<string>} A Promise that resolves to the inbox id that added you to the group.
   */
  async addedByInboxId(): Promise<string> {
    return XMTP.addedByInboxId(this.client.address, this.id)
  }

  /**
   *
   * @param inboxId
   * @returns {Promise<boolean>} whether a given inboxId is an admin of the group.
   * To get the latest admin status from the network, call sync() first.
   */
  async isAdmin(inboxId: string): Promise<boolean> {
    return XMTP.isAdmin(this.client.address, this.id, inboxId)
  }

  /**
   *
   * @param inboxId
   * @returns {Promise<boolean>} whether a given inboxId is a super admin of the group.
   * To get the latest super admin status from the network, call sync() first.
   */
  async isSuperAdmin(inboxId: string): Promise<boolean> {
    return XMTP.isSuperAdmin(this.client.address, this.id, inboxId)
  }

  /**
   *
   * @returns {Promise<string[]>} A Promise that resolves to an array of inboxIds that are admins of the group.
   * To get the latest admin list from the network, call sync() first.
   */
  async listAdmins(): Promise<string[]> {
    return XMTP.listAdmins(this.client.address, this.id)
  }

  /**
   *
   * @returns {Promise<string[]>} A Promise that resolves to an array of inboxIds that are super admins of the group.
   * To get the latest super admin list from the network, call sync() first.
   */
  async listSuperAdmins(): Promise<string[]> {
    return XMTP.listSuperAdmins(this.client.address, this.id)
  }

  /**
   *
   * @param {string} inboxId
   * @returns {Promise<void>} A Promise that resolves when the inboxId is added to the group admins.
   * Will throw if the user does not have the required permissions.
   */
  async addAdmin(inboxId: string): Promise<void> {
    return XMTP.addAdmin(this.client.address, this.id, inboxId)
  }

  /**
   *
   * @param {string} inboxId
   * @returns {Promise<void>} A Promise that resolves when the inboxId is added to the group super admins.
   * Will throw if the user does not have the required permissions.
   */
  async addSuperAdmin(inboxId: string): Promise<void> {
    return XMTP.addSuperAdmin(this.client.address, this.id, inboxId)
  }

  /**
   *
   * @param {string} inboxId
   * @returns {Promise<void>} A Promise that resolves when the inboxId is removed from the group admins.
   * Will throw if the user does not have the required permissions.
   */
  async removeAdmin(inboxId: string): Promise<void> {
    return XMTP.removeAdmin(this.client.address, this.id, inboxId)
  }

  /**
   *
   * @param {string} inboxId
   * @returns {Promise<void>} A Promise that resolves when the inboxId is removed from the group super admins.
   * Will throw if the user does not have the required permissions.
   */
  async removeSuperAdmin(inboxId: string): Promise<void> {
    return XMTP.removeSuperAdmin(this.client.address, this.id, inboxId)
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

  /**
   * @returns {Promise<boolean>} a boolean indicating whether the group is allowed by the user.
   */
  async isAllowed(): Promise<boolean> {
    return await XMTP.isGroupAllowed(this.client.address, this.id)
  }

  /**
   * @returns {Promise<boolean>}  a boolean indicating whether the group is denied by the user.
   */
  async isDenied(): Promise<boolean> {
    return await XMTP.isGroupDenied(this.client.address, this.id)
  }

  /**
   *
   * @returns {Promise<Member[]>} A Promise that resolves to an array of Member objects.
   * To get the latest member list from the network, call sync() first.
   */
  async members(): Promise<Member[]> {
    return await XMTP.listGroupMembers(this.client.address, this.id)
  }
}
