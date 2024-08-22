import type { invitation, keystore } from '@xmtp/proto'

import { Client } from './Client'
import { Conversation, ConversationParams } from './Conversation'
import {
  ConversationVersion,
  ConversationContainer,
} from './ConversationContainer'
import { DecodedMessage } from './DecodedMessage'
import { Group, GroupParams } from './Group'
import { Member } from './Member'
import { CreateGroupOptions } from './types/CreateGroupOptions'
import { EventTypes } from './types/EventTypes'
import { PermissionPolicySet } from './types/PermissionPolicySet'
import { ConversationContext } from '../XMTP.types'
import * as XMTPModule from '../index'
import { ContentCodec } from '../index'
import { getAddress } from '../utils/address'

export default class Conversations<
  ContentTypes extends ContentCodec<any>[] = [],
> {
  client: Client<ContentTypes>
  private known = {} as { [topic: string]: boolean }
  private subscriptions: { [key: string]: { remove: () => void } } = {}

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

  async getHmacKeys(): Promise<keystore.GetConversationHmacKeysResponse> {
    return await XMTPModule.getHmacKeys(this.client.inboxId)
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
    context?: ConversationContext,
    consentProof?: invitation.ConsentProofPayload
  ): Promise<Conversation<ContentTypes>> {
    const checksumAddress = getAddress(peerAddress)
    return await XMTPModule.createConversation(
      this.client,
      checksumAddress,
      context,
      consentProof
    )
  }

  /**
   * This method returns a list of all groups that the client is a member of.
   * To get the latest list of groups from the network, call syncGroups() first.
   *
   * @returns {Promise<Group[]>} A Promise that resolves to an array of Group objects.
   */
  async listGroups(): Promise<Group<ContentTypes>[]> {
    const result = await XMTPModule.listGroups(this.client)

    for (const group of result) {
      this.known[group.id] = true
    }

    return result
  }

  /**
   * This method returns a group by the group id if that group exists in the local database.
   * To get the latest list of groups from the network, call syncGroups() first.
   *
   * @returns {Promise<Group>} A Promise that resolves to a Group or undefined if not found.
   */
  async findGroup(groupId: string): Promise<Group<ContentTypes> | undefined> {
    return await XMTPModule.findGroup(this.client, groupId)
  }

  /**
   * This method returns a message by the message id if that message exists in the local database.
   * To get the latest list of messages from the network, call syncGroups() first.
   *
   * @returns {Promise<DecodedMessage>} A Promise that resolves to a DecodedMessage or undefined if not found.
   */
  async findV3Message(
    messageId: string
  ): Promise<DecodedMessage<ContentTypes> | undefined> {
    return await XMTPModule.findV3Message(this.client, messageId)
  }

  /**
   * This method returns a list of all conversations and groups that the client is a member of.
   * To include the latest groups from the network in the returned list, call syncGroups() first.
   *
   * @returns {Promise<ConversationContainer[]>} A Promise that resolves to an array of ConversationContainer objects.
   */
  async listAll(): Promise<ConversationContainer<ContentTypes>[]> {
    const result = await XMTPModule.listAll(this.client)

    for (const conversationContainer of result) {
      this.known[conversationContainer.topic] = true
    }

    return result
  }

  /**
   * This method streams groups that the client is a member of.
   *
   * @returns {Promise<Group[]>} A Promise that resolves to an array of Group objects.
   */
  async streamGroups(
    callback: (group: Group<ContentTypes>) => Promise<void>
  ): Promise<() => void> {
    XMTPModule.subscribeToGroups(this.client.inboxId)
    const groupsSubscription = XMTPModule.emitter.addListener(
      EventTypes.Group,
      async ({ inboxId, group }: { inboxId: string; group: GroupParams }) => {
        if (this.known[group.id]) {
          return
        }
        this.known[group.id] = true
        const members = group['members'].map((mem: string) => {
          return Member.from(mem)
        })
        await callback(new Group(this.client, group, members))
      }
    )
    this.subscriptions[EventTypes.Group] = groupsSubscription
    return () => {
      groupsSubscription.remove()
      XMTPModule.unsubscribeFromGroups(this.client.inboxId)
    }
  }

  /**
   * Creates a new group.
   *
   * This method creates a new group with the specified peer addresses and options.
   *
   * @param {string[]} peerAddresses - The addresses of the peers to create a group with.
   * @param {CreateGroupOptions} opts - The options to use for the group.
   * @returns {Promise<Group<ContentTypes>>} A Promise that resolves to a Group object.
   */
  async newGroup(
    peerAddresses: string[],
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
   * @param {string[]} peerAddresses - The addresses of the peers to create a group with.
   * @param {PermissionPolicySet} permissionPolicySet - The permission policy set to use for the group.
   * @param {CreateGroupOptions} opts - The options to use for the group.
   * @returns {Promise<Group<ContentTypes>>} A Promise that resolves to a Group object.
   */
  async newGroupCustomPermissions(
    peerAddresses: string[],
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
   * Executes a network request to fetch the latest list of groups associated with the client
   * and save them to the local state.
   */
  async syncGroups() {
    await XMTPModule.syncGroups(this.client.inboxId)
  }

  /**
   * Executes a network request to fetch the latest list of messages for all local groups associated with the client
   * and save them to the local state.
   *
   * @warning call {@linkcode Conversations.syncGroups | syncGroups()} first to get the latest list of groups locally
   */
  async syncAllGroups() {
    await XMTPModule.syncAllGroups(this.client.inboxId)
  }

  /**
   * Sets up a real-time stream to listen for new conversations being started.
   *
   * This method subscribes to conversations in real-time and listens for incoming conversation events.
   * When a new conversation is detected, the provided callback function is invoked with the details of the conversation.
   * @param {Function} callback - A callback function that will be invoked with the new Conversation when a conversation is started.
   * @returns {Promise<void>} A Promise that resolves when the stream is set up.
   * @warning This stream will continue infinitely. To end the stream, you can call {@linkcode Conversations.cancelStream | cancelStream()}.
   */
  async stream(
    callback: (conversation: Conversation<ContentTypes>) => Promise<void>
  ) {
    XMTPModule.subscribeToConversations(this.client.inboxId)
    const subscription = XMTPModule.emitter.addListener(
      EventTypes.Conversation,
      async ({
        inboxId,
        conversation,
      }: {
        inboxId: string
        conversation: ConversationParams
      }) => {
        if (inboxId !== this.client.inboxId) {
          return
        }
        if (this.known[conversation.topic]) {
          return
        }

        this.known[conversation.topic] = true
        await callback(new Conversation(this.client, conversation))
      }
    )
    this.subscriptions[EventTypes.Conversation] = subscription
  }

  /**
   * Sets up a real-time stream to listen for new conversations and groups being started.
   *
   * This method subscribes to conversations in real-time and listens for incoming conversation and group events.
   * When a new conversation is detected, the provided callback function is invoked with the details of the conversation.
   * @param {Function} callback - A callback function that will be invoked with the new Conversation when a conversation is started.
   * @returns {Promise<void>} A Promise that resolves when the stream is set up.
   * @warning This stream will continue infinitely. To end the stream, you can call the function returned by this streamAll.
   */
  async streamAll(
    callback: (
      conversation: ConversationContainer<ContentTypes>
    ) => Promise<void>
  ) {
    XMTPModule.subscribeToAll(this.client.inboxId)
    const subscription = XMTPModule.emitter.addListener(
      EventTypes.ConversationContainer,
      async ({
        inboxId,
        conversationContainer,
      }: {
        inboxId: string
        conversationContainer: ConversationContainer<ContentTypes>
      }) => {
        if (inboxId !== this.client.inboxId) {
          return
        }
        if (this.known[conversationContainer.topic]) {
          return
        }

        this.known[conversationContainer.topic] = true
        if (conversationContainer.version === ConversationVersion.GROUP) {
          const members = conversationContainer['members'].map(
            (mem: string) => {
              return Member.from(mem)
            }
          )
          return await callback(
            new Group(
              this.client,
              conversationContainer as unknown as GroupParams,
              members
            )
          )
        } else {
          return await callback(
            new Conversation(
              this.client,
              conversationContainer as ConversationParams
            )
          )
        }
      }
    )
    return () => {
      subscription.remove()
      this.cancelStream()
    }
  }

  /**
   * Listen for new messages in all conversations.
   *
   * This method subscribes to all conversations in real-time and listens for incoming and outgoing messages.
   * @param {boolean} includeGroups - Whether or not to include group messages in the stream.
   * @param {Function} callback - A callback function that will be invoked when a message is sent or received.
   * @returns {Promise<void>} A Promise that resolves when the stream is set up.
   */
  async streamAllMessages(
    callback: (message: DecodedMessage<ContentTypes>) => Promise<void>,
    includeGroups: boolean = false
  ): Promise<void> {
    XMTPModule.subscribeToAllMessages(this.client.inboxId, includeGroups)
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
        if (this.known[message.id]) {
          return
        }

        this.known[message.id] = true
        await callback(DecodedMessage.fromObject(message, this.client))
      }
    )
    this.subscriptions[EventTypes.Message] = subscription
  }

  /**
   * Listen for new messages in all groups.
   *
   * This method subscribes to all groups in real-time and listens for incoming and outgoing messages.
   * @param {Function} callback - A callback function that will be invoked when a message is sent or received.
   * @returns {Promise<void>} A Promise that resolves when the stream is set up.
   */
  async streamAllGroupMessages(
    callback: (message: DecodedMessage<ContentTypes>) => Promise<void>
  ): Promise<void> {
    XMTPModule.subscribeToAllGroupMessages(this.client.inboxId)
    const subscription = XMTPModule.emitter.addListener(
      EventTypes.AllGroupMessage,
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
        if (this.known[message.id]) {
          return
        }

        this.known[message.id] = true
        await callback(DecodedMessage.fromObject(message, this.client))
      }
    )
    this.subscriptions[EventTypes.AllGroupMessage] = subscription
  }

  async fromWelcome(encryptedMessage: string): Promise<Group<ContentTypes>> {
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
   * Cancels the stream for new conversations.
   */
  cancelStreamGroups() {
    if (this.subscriptions[EventTypes.Group]) {
      this.subscriptions[EventTypes.Group].remove()
      delete this.subscriptions[EventTypes.Group]
    }
    XMTPModule.unsubscribeFromGroups(this.client.inboxId)
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

  /**
   * Cancels the stream for new messages in all groups.
   */
  cancelStreamAllGroupMessages() {
    if (this.subscriptions[EventTypes.AllGroupMessage]) {
      this.subscriptions[EventTypes.AllGroupMessage].remove()
      delete this.subscriptions[EventTypes.AllGroupMessage]
    }
    XMTPModule.unsubscribeFromAllGroupMessages(this.client.inboxId)
  }
}
