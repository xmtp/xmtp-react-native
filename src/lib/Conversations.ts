import { keystore } from '@xmtp/proto'

import { Client, InboxId } from './Client'
import { ConversationVersion } from './Conversation'
import { DecodedMessage } from './DecodedMessage'
import { Dm, DmParams } from './Dm'
import { Group, GroupParams } from './Group'
import { ConversationOptions } from './types/ConversationOptions'
import { CreateGroupOptions } from './types/CreateGroupOptions'
import { DecodedMessageUnion } from './types/DecodedMessageUnion'
import { DefaultContentTypes } from './types/DefaultContentType'
import { EventTypes } from './types/EventTypes'
import { PermissionPolicySet } from './types/PermissionPolicySet'
import * as XMTPModule from '../index'
import {
  Address,
  ConsentState,
  Conversation,
  ConversationId,
  ConversationTopic,
  ConversationType,
  MessageId,
} from '../index'
import { getAddress } from '../utils/address'

export default class Conversations<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> {
  client: Client<ContentTypes>
  private subscriptions: { [key: string]: { remove: () => void } } = {}

  constructor(client: Client<ContentTypes>) {
    this.client = client
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
    return await XMTPModule.findGroup(this.client.installationId, groupId)
  }

  /**
   * This method returns a Dm by the inboxId if that dm exists in the local database.
   * To get the latest list of dms from the network, call sync() first.
   *
   * @returns {Promise<Dm>} A Promise that resolves to a Dm or undefined if not found.
   */
  async findDmByInboxId(
    inboxId: InboxId
  ): Promise<Dm<ContentTypes> | undefined> {
    return await XMTPModule.findDmByInboxId(this.client.installationId, inboxId)
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
    return await XMTPModule.findDmByAddress(this.client.installationId, address)
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
    return await XMTPModule.findConversationByTopic(
      this.client.installationId,
      topic
    )
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
    return await XMTPModule.findConversation(
      this.client.installationId,
      conversationId
    )
  }

  /**
   * This method returns a message by the message id if that message exists in the local database.
   * To get the latest list of messages from the network, call sync() first.
   *
   * @returns {Promise<DecodedMessage>} A Promise that resolves to a DecodedMessage or undefined if not found.
   */
  async findMessage(
    messageId: MessageId
  ): Promise<DecodedMessageUnion<ContentTypes> | undefined> {
    return await XMTPModule.findMessage(this.client.installationId, messageId)
  }

  async fromWelcome(
    encryptedMessage: string
  ): Promise<Conversation<ContentTypes>> {
    try {
      return await XMTPModule.processWelcomeMessage(
        this.client.installationId,
        encryptedMessage
      )
    } catch (e) {
      console.info('ERROR in processWelcomeMessage()', e)
      throw e
    }
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
    return await XMTPModule.findOrCreateDm(
      this.client.installationId,
      checksumAddress
    )
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
    return await XMTPModule.findOrCreateDm(
      this.client.installationId,
      peerAddress
    )
  }

  /**
   * Creates a new conversation.
   *
   * This method creates a new conversation with the specified peer inboxId.
   *
   * @param {InboxId} peerInboxId - The inboxId of the peer to create a conversation with.
   * @returns {Promise<Dm>} A Promise that resolves to a Dm object.
   */
  async findOrCreateDmWithInboxId(
    peerInboxId: InboxId
  ): Promise<Dm<ContentTypes>> {
    return await XMTPModule.findOrCreateDmWithInboxId(
      this.client.installationId,
      peerInboxId
    )
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
      this.client.installationId,
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
      this.client.installationId,
      peerAddresses,
      permissionPolicySet,
      opts?.name,
      opts?.imageUrlSquare,
      opts?.description,
      opts?.pinnedFrameUrl
    )
  }

  /**
   * Creates a new group.
   *
   * This method creates a new group with the specified peer inboxIds and options.
   *
   * @param {InboxId[]} peerInboxIds - The inboxIds of the peers to create a group with.
   * @param {CreateGroupOptions} opts - The options to use for the group.
   * @returns {Promise<Group<ContentTypes>>} A Promise that resolves to a Group object.
   */
  async newGroupWithInboxIds(
    peerInboxIds: InboxId[],
    opts?: CreateGroupOptions | undefined
  ): Promise<Group<ContentTypes>> {
    return await XMTPModule.createGroupWithInboxIds(
      this.client.installationId,
      peerInboxIds,
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
   * This method creates a new group with the specified peer inboxIds and options.
   *
   * @param {InboxId[]} peerInboxIds - The inboxIds of the peers to create a group with.
   * @param {PermissionPolicySet} permissionPolicySet - The permission policy set to use for the group.
   * @param {CreateGroupOptions} opts - The options to use for the group.
   * @returns {Promise<Group<ContentTypes>>} A Promise that resolves to a Group object.
   */
  async newGroupCustomPermissionsWithInboxIds(
    peerInboxIds: InboxId[],
    permissionPolicySet: PermissionPolicySet,
    opts?: CreateGroupOptions | undefined
  ): Promise<Group<ContentTypes>> {
    return await XMTPModule.createGroupCustomPermissionsWithInboxIds(
      this.client.installationId,
      peerInboxIds,
      permissionPolicySet,
      opts?.name,
      opts?.imageUrlSquare,
      opts?.description,
      opts?.pinnedFrameUrl
    )
  }

  /**
   * This method returns a list of all groups that the client is a member of.
   * To get the latest list of groups from the network, call syncGroups() first.
   * @param {ConversationOptions} opts - The options to specify what fields you want returned for the groups in the list.
   * @param {number} limit - Limit the number of groups returned in the list.
   * @param {consentStates} ConsentState[] - Filter the groups by a list of consent states.
   *
   * @returns {Promise<Group[]>} A Promise that resolves to an array of Group objects.
   */
  async listGroups(
    opts?: ConversationOptions | undefined,
    limit?: number | undefined,
    consentStates?: ConsentState[] | undefined
  ): Promise<Group<ContentTypes>[]> {
    return await XMTPModule.listGroups(
      this.client.installationId,
      opts,
      limit,
      consentStates
    )
  }

  /**
   * This method returns a list of all dms that the client is a member of.
   * To get the latest list of dms from the network, call sync() first.
   * @param {ConversationOptions} opts - The options to specify what fields you want returned for the dms in the list.
   * @param {number} limit - Limit the number of dms returned in the list.
   * @param {consentStates} ConsentState[] - Filter the dms by a list of consent states.
   *
   * @returns {Promise<Dm[]>} A Promise that resolves to an array of Dms objects.
   */
  async listDms(
    opts?: ConversationOptions | undefined,
    limit?: number | undefined,
    consentStates?: ConsentState[] | undefined
  ): Promise<Dm<ContentTypes>[]> {
    return await XMTPModule.listDms(
      this.client.installationId,
      opts,
      limit,
      consentStates
    )
  }

  /**
   * This method returns a list of all conversations that the client is a member of.
   * @param {ConversationOptions} opts - The options to specify what fields you want returned for the conversations in the list.
   * @param {number} limit - Limit the number of conversations returned in the list.
   * @param {consentStates} ConsentState[] - Filter the conversations by a list of consent states.
   *
   * @returns {Promise<Conversation[]>} A Promise that resolves to an array of Conversation objects.
   */
  async list(
    opts?: ConversationOptions | undefined,
    limit?: number | undefined,
    consentStates?: ConsentState[] | undefined
  ): Promise<Conversation<ContentTypes>[]> {
    return await XMTPModule.listConversations(
      this.client.installationId,
      opts,
      limit,
      consentStates
    )
  }

  /**
   * This method returns a list of hmac keys for the conversation to help filter self push notifications
   */
  async getHmacKeys(): Promise<keystore.GetConversationHmacKeysResponse> {
    return await XMTPModule.getHmacKeys(this.client.installationId)
  }

  /**
   * Executes a network request to fetch the latest list of conversations associated with the client
   * and save them to the local state.
   */
  async sync() {
    await XMTPModule.syncConversations(this.client.installationId)
  }

  /**
   * Executes a network request to sync all active conversations associated with the client
   * @param {consentStates} ConsentState[] - Filter the conversations to sync by a list of consent states.
   *
   * @returns {Promise<number>} A Promise that resolves to the number of conversations synced.
   */
  async syncAllConversations(
    consentStates: ConsentState[] | undefined = undefined
  ): Promise<number> {
    return await XMTPModule.syncAllConversations(
      this.client.installationId,
      consentStates
    )
  }

  /**
   * This method streams conversations that the client is a member of.
   * @param {type} ConversationType - Whether to stream groups, dms, or both
   * @returns {Promise<Conversation[]>} A Promise that resolves to an array of Conversation objects.
   */
  async stream(
    callback: (conversation: Conversation<ContentTypes>) => Promise<void>,
    type: ConversationType = 'all'
  ): Promise<void> {
    XMTPModule.subscribeToConversations(this.client.installationId, type)
    const subscription = XMTPModule.emitter.addListener(
      EventTypes.Conversation,
      async ({
        installationId,
        conversation,
      }: {
        installationId: string
        conversation: Conversation<ContentTypes>
      }) => {
        if (installationId !== this.client.installationId) {
          return
        }
        if (conversation.version === ConversationVersion.GROUP) {
          return await callback(
            new Group(
              this.client.installationId,
              conversation as unknown as GroupParams
            )
          )
        } else if (conversation.version === ConversationVersion.DM) {
          return await callback(
            new Dm(
              this.client.installationId,
              conversation as unknown as DmParams
            )
          )
        }
      }
    )
    this.subscriptions[EventTypes.Conversation] = subscription
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
    callback: (message: DecodedMessageUnion<ContentTypes>) => Promise<void>,
    type: ConversationType = 'all'
  ): Promise<void> {
    XMTPModule.subscribeToAllMessages(this.client.installationId, type)
    const subscription = XMTPModule.emitter.addListener(
      EventTypes.Message,
      async ({
        installationId,
        message,
      }: {
        installationId: string
        message: DecodedMessage
      }) => {
        if (installationId !== this.client.installationId) {
          return
        }
        await callback(
          DecodedMessage.fromObject(
            message
          ) as DecodedMessageUnion<ContentTypes>
        )
      }
    )
    this.subscriptions[EventTypes.Message] = subscription
  }

  /**
   * Cancels the stream for new conversations.
   */
  cancelStream() {
    if (this.subscriptions[EventTypes.Conversation]) {
      this.subscriptions[EventTypes.Conversation].remove()
      delete this.subscriptions[EventTypes.Conversation]
    }
    XMTPModule.unsubscribeFromConversations(this.client.installationId)
  }

  /**
   * Cancels the stream for new messages in all conversations.
   */
  cancelStreamAllMessages() {
    if (this.subscriptions[EventTypes.Message]) {
      this.subscriptions[EventTypes.Message].remove()
      delete this.subscriptions[EventTypes.Message]
    }
    XMTPModule.unsubscribeFromAllMessages(this.client.installationId)
  }
}
