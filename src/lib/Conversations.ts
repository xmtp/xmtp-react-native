import { Client } from './Client'
import { ConversationVersion } from './Conversation'
import { DecodedMessage } from './DecodedMessage'
import { Dm, DmParams } from './Dm'
import { Group, GroupParams } from './Group'
import {
  ConversationOrder,
  ConversationOptions,
} from './types/ConversationOptions'
import { CreateGroupOptions } from './types/CreateGroupOptions'
import { EventTypes } from './types/EventTypes'
import { PermissionPolicySet } from './types/PermissionPolicySet'
import * as XMTPModule from '../index'
import {
  Address,
  ContentCodec,
  Conversation,
  ConversationId,
  ConversationTopic,
  ConversationType,
  MessageId,
} from '../index'
import { getAddress } from '../utils/address'

export default class Conversations<
  ContentTypes extends ContentCodec<any>[] = [],
> {
  client: Client<ContentTypes>
  private subscriptions: { [key: string]: { remove: () => void } } = {}

  constructor(client: Client<ContentTypes>) {
    this.client = client
  }

  /**
   * Creates a new conversation.
   *
   * This method creates a new conversation with the specified peer address and context.
   *
   * @param {Address} peerAddress - The address of the peer to create a conversation with.
   * @returns {Promise<Conversation>} A Promise that resolves to a Conversation object.
   */
  async newConversation(
    peerAddress: Address
  ): Promise<Conversation<ContentTypes>> {
    const checksumAddress = getAddress(peerAddress)
    return await XMTPModule.findOrCreateDm(this.client, checksumAddress)
  }

  /**
   * Creates a new conversation.
   *
   * This method creates a new conversation with the specified peer address.
   *
   * @param {Address} peerAddress - The address of the peer to create a conversation with.
   * @returns {Promise<Dm>} A Promise that resolves to a Dm object.
   */
  async findOrCreateDm(peerAddress: Address): Promise<Dm<ContentTypes>> {
    return await XMTPModule.findOrCreateDm(this.client, peerAddress)
  }

  /**
   * This method returns a list of all groups that the client is a member of.
   * To get the latest list of groups from the network, call syncGroups() first.
   * @param {ConversationOptions} opts - The options to specify what fields you want returned for the groups in the list.
   * @param {ConversationOrder} order - The order to specify if you want groups listed by last message or by created at.
   * @param {number} limit - Limit the number of groups returned in the list.
   *
   * @returns {Promise<Group[]>} A Promise that resolves to an array of Group objects.
   */
  async listGroups(
    opts?: ConversationOptions | undefined,
    order?: ConversationOrder | undefined,
    limit?: number | undefined
  ): Promise<Group<ContentTypes>[]> {
    return await XMTPModule.listGroups(this.client, opts, order, limit)
  }

  /**
   * This method returns a list of all dms that the client is a member of.
   * To get the latest list of dms from the network, call sync() first.
   * @param {ConversationOptions} opts - The options to specify what fields you want returned for the dms in the list.
   * @param {ConversationOrder} order - The order to specify if you want dms listed by last message or by created at.
   * @param {number} limit - Limit the number of dms returned in the list.
   *
   * @returns {Promise<Dm[]>} A Promise that resolves to an array of Dms objects.
   */
  async listDms(
    opts?: ConversationOptions | undefined,
    order?: ConversationOrder | undefined,
    limit?: number | undefined
  ): Promise<Dm<ContentTypes>[]> {
    return await XMTPModule.listDms(this.client, opts, order, limit)
  }

  /**
   * This method returns a group by the group id if that group exists in the local database.
   * To get the latest list of groups from the network, call sync() first.
   *
   * @returns {Promise<Group>} A Promise that resolves to a Group or undefined if not found.
   */
  async findGroup(
    groupId: ConversationId
  ): Promise<Group<ContentTypes> | undefined> {
    return await XMTPModule.findGroup(this.client, groupId)
  }

  /**
   * This method returns a Dm by the address if that dm exists in the local database.
   * To get the latest list of dms from the network, call sync() first.
   *
   * @returns {Promise<Dm>} A Promise that resolves to a Dm or undefined if not found.
   */
  async findDmByAddress(
    address: Address
  ): Promise<Dm<ContentTypes> | undefined> {
    return await XMTPModule.findDmByAddress(this.client, address)
  }

  /**
   * This method returns a conversation by the topic if that conversation exists in the local database.
   * To get the latest list of conversations from the network, call sync() first.
   *
   * @returns {Promise<Conversation>} A Promise that resolves to a Conversation or undefined if not found.
   */
  async findConversationByTopic(
    topic: ConversationTopic
  ): Promise<Conversation<ContentTypes> | undefined> {
    return await XMTPModule.findConversationByTopic(this.client, topic)
  }

  /**
   * This method returns a conversation by the conversation id if that conversation exists in the local database.
   * To get the latest list of conversations from the network, call sync() first.
   *
   * @returns {Promise<Conversation>} A Promise that resolves to a Conversation or undefined if not found.
   */
  async findConversation(
    conversationId: ConversationId
  ): Promise<Conversation<ContentTypes> | undefined> {
    return await XMTPModule.findConversation(this.client, conversationId)
  }

  /**
   * This method returns a message by the message id if that message exists in the local database.
   * To get the latest list of messages from the network, call sync() first.
   *
   * @returns {Promise<DecodedMessage>} A Promise that resolves to a DecodedMessage or undefined if not found.
   */
  async findMessage(
    messageId: MessageId
  ): Promise<DecodedMessage<ContentTypes> | undefined> {
    return await XMTPModule.findMessage(this.client, messageId)
  }

  /**
   * This method returns a list of all V3 conversations that the client is a member of.
   * To include the latest conversations from the network in the returned list, call sync() first.
   *
   * @returns {Promise<Conversation[]>} A Promise that resolves to an array of Conversation objects.
   */
  async list(
    opts?: ConversationOptions | undefined,
    order?: ConversationOrder | undefined,
    limit?: number | undefined
  ): Promise<Conversation<ContentTypes>[]> {
    return await XMTPModule.listConversations(this.client, opts, order, limit)
  }

  /**
   * This method streams conversations that the client is a member of.
   * @param {type} ConversationType - Whether to stream groups, dms, or both
   * @returns {Promise<Conversation[]>} A Promise that resolves to an array of Conversation objects.
   */
  async stream(
    callback: (conversation: Conversation<ContentTypes>) => Promise<void>,
    type: ConversationType = 'all'
  ): Promise<() => void> {
    XMTPModule.subscribeToConversations(this.client.inboxId, type)
    const subscription = XMTPModule.emitter.addListener(
      EventTypes.Conversation,
      async ({
        inboxId,
        conversation,
      }: {
        inboxId: string
        conversation: Conversation<ContentTypes>
      }) => {
        if (inboxId !== this.client.inboxId) {
          return
        }
        if (conversation.version === ConversationVersion.GROUP) {
          return await callback(
            new Group(this.client, conversation as unknown as GroupParams)
          )
        } else if (conversation.version === ConversationVersion.DM) {
          return await callback(
            new Dm(this.client, conversation as unknown as DmParams)
          )
        }
      }
    )
    return () => {
      subscription.remove()
      XMTPModule.unsubscribeFromConversations(this.client.inboxId)
    }
  }

  /**
   * Creates a new group.
   *
   * This method creates a new group with the specified peer addresses and options.
   *
   * @param {Address[]} peerAddresses - The addresses of the peers to create a group with.
   * @param {CreateGroupOptions} opts - The options to use for the group.
   * @returns {Promise<Group<ContentTypes>>} A Promise that resolves to a Group object.
   */
  async newGroup(
    peerAddresses: Address[],
    opts?: CreateGroupOptions | undefined
  ): Promise<Group<ContentTypes>> {
    return await XMTPModule.createGroup(
      this.client,
      peerAddresses,
      opts?.permissionLevel,
      opts?.name,
      opts?.imageUrlSquare,
      opts?.description,
      opts?.pinnedFrameUrl
    )
  }

  /**
   * Creates a new group with custom permissions.
   *
   * This method creates a new group with the specified peer addresses and options.
   *
   * @param {Address[]} peerAddresses - The addresses of the peers to create a group with.
   * @param {PermissionPolicySet} permissionPolicySet - The permission policy set to use for the group.
   * @param {CreateGroupOptions} opts - The options to use for the group.
   * @returns {Promise<Group<ContentTypes>>} A Promise that resolves to a Group object.
   */
  async newGroupCustomPermissions(
    peerAddresses: Address[],
    permissionPolicySet: PermissionPolicySet,
    opts?: CreateGroupOptions | undefined
  ): Promise<Group<ContentTypes>> {
    return await XMTPModule.createGroupCustomPermissions(
      this.client,
      peerAddresses,
      permissionPolicySet,
      opts?.name,
      opts?.imageUrlSquare,
      opts?.description,
      opts?.pinnedFrameUrl
    )
  }

  /**
   * Executes a network request to fetch the latest list of conversations associated with the client
   * and save them to the local state.
   */
  async sync() {
    await XMTPModule.syncConversations(this.client.inboxId)
  }

  /**
   * Executes a network request to sync all active conversations associated with the client
   *
   * @returns {Promise<number>} A Promise that resolves to the number of conversations synced.
   */
  async syncAllConversations(): Promise<number> {
    return await XMTPModule.syncAllConversations(this.client.inboxId)
  }

  /**
   * Listen for new messages in all conversations.
   *
   * This method subscribes to all conversations in real-time and listens for incoming and outgoing messages.
   * @param {type} ConversationType - Whether to stream messages from groups, dms, or both
   * @param {Function} callback - A callback function that will be invoked when a message is sent or received.
   * @returns {Promise<void>} A Promise that resolves when the stream is set up.
   */
  async streamAllMessages(
    callback: (message: DecodedMessage<ContentTypes>) => Promise<void>,
    type: ConversationType = 'all'
  ): Promise<void> {
    XMTPModule.subscribeToAllMessages(this.client.inboxId, type)
    const subscription = XMTPModule.emitter.addListener(
      EventTypes.Message,
      async ({
        inboxId,
        message,
      }: {
        inboxId: string
        message: DecodedMessage
      }) => {
        if (inboxId !== this.client.inboxId) {
          return
        }
        await callback(DecodedMessage.fromObject(message, this.client))
      }
    )
    this.subscriptions[EventTypes.Message] = subscription
  }

  async fromWelcome(
    encryptedMessage: string
  ): Promise<Conversation<ContentTypes>> {
    try {
      return await XMTPModule.processWelcomeMessage(
        this.client,
        encryptedMessage
      )
    } catch (e) {
      console.info('ERROR in processWelcomeMessage()', e)
      throw e
    }
  }

  /**
   * Cancels the stream for new conversations.
   */
  cancelStream() {
    if (this.subscriptions[EventTypes.Conversation]) {
      this.subscriptions[EventTypes.Conversation].remove()
      delete this.subscriptions[EventTypes.Conversation]
    }
    XMTPModule.unsubscribeFromConversations(this.client.inboxId)
  }

  /**
   * Cancels the stream for new messages in all conversations.
   */
  cancelStreamAllMessages() {
    if (this.subscriptions[EventTypes.Message]) {
      this.subscriptions[EventTypes.Message].remove()
      delete this.subscriptions[EventTypes.Message]
    }
    XMTPModule.unsubscribeFromAllMessages(this.client.inboxId)
  }
}
