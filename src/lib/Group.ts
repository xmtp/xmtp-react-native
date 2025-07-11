import { keystore } from '@xmtp/proto'
import { Subscription } from 'expo-modules-core'

import { Client, InboxId } from './Client'
import { ConsentState } from './ConsentRecord'
import { ConversationBase, ConversationVersion } from './Conversation'
import { DecodedMessage } from './DecodedMessage'
import { Member, MembershipResult } from './Member'
import * as XMTP from '../index'
import {
  ConversationDebugInfo,
  ConversationId,
  ConversationTopic,
  DisappearingMessageSettings,
  PublicIdentity,
} from '../index'
import { ConversationSendPayload } from './types/ConversationCodecs'
import { DecodedMessageUnion } from './types/DecodedMessageUnion'
import { DefaultContentTypes } from './types/DefaultContentType'
import { EventTypes } from './types/EventTypes'
import { MessageId, MessagesOptions } from './types/MessagesOptions'
import { PermissionPolicySet } from './types/PermissionPolicySet'
import { SendOptions } from './types/SendOptions'


export type PermissionUpdateOption = 'allow' | 'deny' | 'admin' | 'super_admin'

export interface GroupParams {
  id: ConversationId
  createdAt: number
  topic: ConversationTopic
  name: string
  isActive: boolean
  addedByInboxId: InboxId
  imageUrl: string
  description: string
  consentState: ConsentState
  lastMessage?: DecodedMessage
}

export class Group<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> implements ConversationBase<ContentTypes>
{
  client: Client<ContentTypes>
  id: ConversationId
  createdAt: number
  version = ConversationVersion.GROUP as const
  topic: ConversationTopic
  groupName: string
  isGroupActive: boolean
  addedByInboxId: InboxId
  groupImageUrl: string
  groupDescription: string
  state: ConsentState
  lastMessage?: DecodedMessageUnion<ContentTypes>

  constructor(
    client: Client<ContentTypes>,
    params: GroupParams,
    lastMessage?: DecodedMessageUnion<ContentTypes>
  ) {
    this.client = client
    this.id = params.id
    this.createdAt = params.createdAt
    this.topic = params.topic
    this.groupName = params.name
    this.isGroupActive = params.isActive
    this.addedByInboxId = params.addedByInboxId
    this.groupImageUrl = params.imageUrl
    this.groupDescription = params.description
    this.state = params.consentState
    this.lastMessage = lastMessage
  }

  /**
   * This method returns an array of inbox ids associated with the group.
   * To get the latest member inbox ids from the network, call sync() first.
   * @returns {Promise<InboxId[]>} A Promise that resolves to an array of InboxId objects.
   */
  async memberInboxIds(): Promise<InboxId[]> {
    return XMTP.listMemberInboxIds(this.client.installationId, this.id)
  }

  /**
   * This method returns a inbox id associated with the creator of the group.
   * @returns {Promise<InboxId>} A Promise that resolves to a InboxId.
   */
  async creatorInboxId(): Promise<InboxId> {
    return XMTP.creatorInboxId(this.client.installationId, this.id)
  }

  /**
   * Sends a message to the current group.
   *
   * @param {string | MessageContent} content - The content of the message. It can be either a string or a structured MessageContent object.
   * @returns {Promise<MessageId>} A Promise that resolves to a string identifier for the sent message.
   * @throws {Error} Throws an error if there is an issue with sending the message.
   */
  async send<SendContentTypes extends DefaultContentTypes = ContentTypes>(
    content: ConversationSendPayload<SendContentTypes>,
    opts?: SendOptions
  ): Promise<MessageId> {
    if (opts && opts.contentType) {
      return await this._sendWithJSCodec(content, opts.contentType)
    }

    try {
      if (typeof content === 'string') {
        content = { text: content }
      }

      return await XMTP.sendMessage(
        this.client.installationId,
        this.id,
        content
      )
    } catch (e) {
      console.info('ERROR in send()', e.message)
      throw e
    }
  }

  private async _sendWithJSCodec<T>(
    content: T,
    contentType: XMTP.ContentTypeId
  ): Promise<MessageId> {
    const codec =
      Client.codecRegistry[
        `${contentType.authorityId}/${contentType.typeId}:${contentType.versionMajor}.${contentType.versionMinor}`
      ]

    if (!codec) {
      throw new Error(`no codec found for: ${contentType}`)
    }

    return await XMTP.sendWithContentType(
      this.client.installationId,
      this.id,
      content,
      codec
    )
  }

  /**
   * Prepare a group message to be sent.
   *
   * @param {string | MessageContent} content - The content of the message. It can be either a string or a structured MessageContent object.
   * @returns {Promise<MessageId>} A Promise that resolves to a string identifier for the prepared message to be sent.
   * @throws {Error} Throws an error if there is an issue with sending the message.
   */
  async prepareMessage<
    SendContentTypes extends DefaultContentTypes = ContentTypes,
  >(
    content: ConversationSendPayload<SendContentTypes>,
    opts?: SendOptions
  ): Promise<MessageId> {
    if (opts && opts.contentType) {
      return await this._prepareWithJSCodec(content, opts.contentType)
    }

    try {
      if (typeof content === 'string') {
        content = { text: content }
      }

      return await XMTP.prepareMessage(
        this.client.installationId,
        this.id,
        content
      )
    } catch (e) {
      console.info('ERROR in prepareGroupMessage()', e.message)
      throw e
    }
  }

  private async _prepareWithJSCodec<T>(
    content: T,
    contentType: XMTP.ContentTypeId
  ): Promise<MessageId> {
    const codec =
      Client.codecRegistry[
        `${contentType.authorityId}/${contentType.typeId}:${contentType.versionMajor}.${contentType.versionMinor}`
      ]

    if (!codec) {
      throw new Error(`no codec found for: ${contentType}`)
    }

    return await XMTP.prepareMessageWithContentType(
      this.client.installationId,
      this.id,
      content,
      codec
    )
  }

  /**
   * Publish all prepared messages.
   *
   * @throws {Error} Throws an error if there is an issue finding the unpublished message
   */
  async publishPreparedMessages() {
    try {
      return await XMTP.publishPreparedMessages(
        this.client.installationId,
        this.id
      )
    } catch (e) {
      console.info('ERROR in publishPreparedMessages()', e.message)
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
  ): Promise<DecodedMessageUnion<ContentTypes>[]> {
    return await XMTP.conversationMessages(
      this.client.installationId,
      this.id,
      opts?.limit,
      opts?.beforeNs,
      opts?.afterNs,
      opts?.direction
    )
  }

  /**
   * This method returns an array of messages associated with the group.
   * To get the latest messages from the network, call sync() first.
   *
   * @param {number | undefined} limit - Optional maximum number of messages to return.
   * @param {number | Date | undefined} before - Optional filter for specifying the maximum timestamp of messages to return.
   * @param {number | Date | undefined} after - Optional filter for specifying the minimum timestamp of messages to return.
   * @param direction - Optional parameter to specify the time ordering of the messages to return.
   * @returns {Promise<DecodedMessage<ContentTypes>[]>} A Promise that resolves to an array of DecodedMessage objects,
   * each of which will contain any related reactions under the childMessages property.
   */

  async messagesWithReactions(
    opts?: MessagesOptions
  ): Promise<DecodedMessageUnion<ContentTypes>[]> {
    return await XMTP.conversationMessagesWithReactions(
      this.client.installationId,
      this.id,
      opts?.limit,
      opts?.beforeNs,
      opts?.afterNs,
      opts?.direction
    )
  }

  /**
   * Executes a network request to fetch the latest messages and membership changes
   * associated with the group and saves them to the local state.
   */
  async sync() {
    await XMTP.syncConversation(this.client.installationId, this.id)
  }

  /**
   * Sets up a real-time message stream for the current group.
   *
   * This method subscribes to incoming messages in real-time and listens for new message events.
   * When a new message is detected, the provided callback function is invoked with the details of the message.
   * Additionally, this method returns a function that can be called to unsubscribe and end the message stream.
   *
   * @param {Function} callback - A callback function that will be invoked with the new DecodedMessage when a message is received.
   * @param {Function} [onClose] - Optional callback to invoke when the stream is closed.
   * @returns {Function} A function that, when called, unsubscribes from the message stream and ends real-time updates.
   */
  async streamMessages(
    callback: (message: DecodedMessage<ContentTypes[number]>) => Promise<void>,
    onClose?: () => void
  ): Promise<() => void> {
    await XMTP.subscribeToMessages(this.client.installationId, this.id)
    const messageSubscription = XMTP.emitter.addListener(
      EventTypes.ConversationMessage,
      async ({
        installationId,
        message,
        conversationId,
      }: {
        installationId: string
        message: DecodedMessage<ContentTypes[number]>
        conversationId: string
      }) => {
        if (installationId !== this.client.installationId) {
          return
        }
        if (conversationId !== this.id) {
          return
        }

        await callback(DecodedMessage.fromObject(message))
      }
    )
    let closedSubscription: Subscription | undefined

    if (onClose) {
      closedSubscription = XMTP.emitter.addListener(
        EventTypes.ConversationMessageClosed,
        ({
          installationId,
          conversationId,
        }: {
          installationId: string
          conversationId: string
        }) => {
          if (
            installationId !== this.client.installationId ||
            conversationId !== this.id
          ) {
            return
          }

          onClose()
        }
      )
    }

    return async () => {
      messageSubscription.remove()
      closedSubscription?.remove()
      await XMTP.unsubscribeFromMessages(this.client.installationId, this.id)
    }
  }
  /**
   *
   * @param inboxIds inboxIds to add to the group
   * @returns
   */
  async addMembers(inboxIds: InboxId[]): Promise<MembershipResult> {
    return XMTP.addGroupMembers(this.client.installationId, this.id, inboxIds)
  }

  /**
   *
   * @param inboxIds inboxIds to remove from the group
   * @returns
   */
  async removeMembers(inboxIds: InboxId[]): Promise<void> {
    return XMTP.removeGroupMembers(
      this.client.installationId,
      this.id,
      inboxIds
    )
  }

  /**
   *
   * @param identities identities to add to the group
   * @returns
   */
  async addMembersByIdentity(
    identities: PublicIdentity[]
  ): Promise<MembershipResult> {
    return XMTP.addGroupMembersByIdentity(
      this.client.installationId,
      this.id,
      identities
    )
  }

  /**
   *
   * @param identities identities to remove from the group
   * @returns
   */
  async removeMembersByIdentity(identities: PublicIdentity[]): Promise<void> {
    return XMTP.removeGroupMembersByIdentity(
      this.client.installationId,
      this.id,
      identities
    )
  }

  /**
   * Returns the group name.
   * To get the latest group name from the network, call sync() first.
   * @returns {string} A Promise that resolves to the group name.
   */
  async name(): Promise<string> {
    return XMTP.groupName(this.client.installationId, this.id)
  }

  /**
   * Updates the group name.
   * Will throw if the user does not have the required permissions.
   * @param {string} groupName new group name
   * @returns
   */

  async updateName(groupName: string): Promise<void> {
    return XMTP.updateGroupName(this.client.installationId, this.id, groupName)
  }

  /**
   * Returns the group image url square.
   * To get the latest group image url square from the network, call sync() first.
   * @returns {string} A Promise that resolves to the group image url.
   */
  async imageUrl(): Promise<string> {
    return XMTP.groupImageUrl(this.client.installationId, this.id)
  }

  /**
   * Updates the group image url square.
   * Will throw if the user does not have the required permissions.
   * @param {string} imageUrl new group profile image url
   * @returns
   */

  async updateImageUrl(imageUrl: string): Promise<void> {
    return XMTP.updateGroupImageUrl(
      this.client.installationId,
      this.id,
      imageUrl
    )
  }

  /**
   * Returns the group description.
   * To get the latest group description from the network, call sync() first.
   * @returns {string} A Promise that resolves to the group description.
   */
  async description(): Promise<string> {
    return XMTP.groupDescription(this.client.installationId, this.id)
  }

  /**
   * Updates the group description.
   * Will throw if the user does not have the required permissions.
   * @param {string} description new group description
   * @returns
   */

  async updateDescription(description: string): Promise<void> {
    return XMTP.updateGroupDescription(
      this.client.installationId,
      this.id,
      description
    )
  }

  /**
   * Returns the disappearing message settings.
   * To get the latest settings from the network, call sync() first.
   * @returns {Promise<DisappearingMessageSettings | undefined>} A Promise that resolves to the disappearing message settings.
   */
  async disappearingMessageSettings(): Promise<
    DisappearingMessageSettings | undefined
  > {
    return XMTP.disappearingMessageSettings(this.client.installationId, this.id)
  }

  /**
   * Checks if disappearing messages are enabled.
   * @returns {Promise<boolean>} A Promise that resolves to a boolean indicating whether disappearing messages are enabled.
   */
  async isDisappearingMessagesEnabled(): Promise<boolean> {
    return XMTP.isDisappearingMessagesEnabled(
      this.client.installationId,
      this.id
    )
  }

  /**
   * Clears the disappearing message settings for this group.
   * Will throw if the user does not have the required permissions.
   * @returns {Promise<void>} A Promise that resolves when the settings are cleared.
   */
  async clearDisappearingMessageSettings(): Promise<void> {
    return XMTP.clearDisappearingMessageSettings(
      this.client.installationId,
      this.id
    )
  }

  /**
   * Updates the disappearing message settings.
   * Will throw if the user does not have the required permissions.
   * @param {DisappearingMessageSettings} disappearingMessageSettings The new disappearing message setting.
   * @returns {Promise<void>} A Promise that resolves when the settings are updated.
   */
  async updateDisappearingMessageSettings(
    disappearingMessageSettings: DisappearingMessageSettings
  ): Promise<void> {
    return XMTP.updateDisappearingMessageSettings(
      this.client.installationId,
      this.id,
      disappearingMessageSettings.disappearStartingAtNs,
      disappearingMessageSettings.retentionDurationInNs
    )
  }

  /**
   * Returns whether the group is active.
   * To get the latest active status from the network, call sync() first
   * @returns {Promise<boolean>} A Promise that resolves if the group is active or not
   */

  async isActive(): Promise<boolean> {
    return XMTP.isGroupActive(this.client.installationId, this.id)
  }

  /**
   *
   * @param inboxId
   * @returns {Promise<boolean>} whether a given inboxId is an admin of the group.
   * To get the latest admin status from the network, call sync() first.
   */
  async isAdmin(inboxId: InboxId): Promise<boolean> {
    return XMTP.isAdmin(this.client.installationId, this.id, inboxId)
  }

  /**
   *
   * @param inboxId
   * @returns {Promise<boolean>} whether a given inboxId is a super admin of the group.
   * To get the latest super admin status from the network, call sync() first.
   */
  async isSuperAdmin(inboxId: InboxId): Promise<boolean> {
    return XMTP.isSuperAdmin(this.client.installationId, this.id, inboxId)
  }

  /**
   *
   * @returns {Promise<string[]>} A Promise that resolves to an array of inboxIds that are admins of the group.
   * To get the latest admin list from the network, call sync() first.
   */
  async listAdmins(): Promise<InboxId[]> {
    return XMTP.listAdmins(this.client.installationId, this.id)
  }

  /**
   *
   * @returns {Promise<string[]>} A Promise that resolves to an array of inboxIds that are super admins of the group.
   * To get the latest super admin list from the network, call sync() first.
   */
  async listSuperAdmins(): Promise<InboxId[]> {
    return XMTP.listSuperAdmins(this.client.installationId, this.id)
  }

  /**
   *
   * @param {InboxId} inboxId
   * @returns {Promise<void>} A Promise that resolves when the inboxId is added to the group admins.
   * Will throw if the user does not have the required permissions.
   */
  async addAdmin(inboxId: InboxId): Promise<void> {
    return XMTP.addAdmin(this.client.installationId, this.id, inboxId)
  }

  /**
   *
   * @param {InboxId} inboxId
   * @returns {Promise<void>} A Promise that resolves when the inboxId is added to the group super admins.
   * Will throw if the user does not have the required permissions.
   */
  async addSuperAdmin(inboxId: InboxId): Promise<void> {
    return XMTP.addSuperAdmin(this.client.installationId, this.id, inboxId)
  }

  /**
   *
   * @param {InboxId} inboxId
   * @returns {Promise<void>} A Promise that resolves when the inboxId is removed from the group admins.
   * Will throw if the user does not have the required permissions.
   */
  async removeAdmin(inboxId: InboxId): Promise<void> {
    return XMTP.removeAdmin(this.client.installationId, this.id, inboxId)
  }

  /**
   *
   * @param {InboxId} inboxId
   * @returns {Promise<void>} A Promise that resolves when the inboxId is removed from the group super admins.
   * Will throw if the user does not have the required permissions.
   */
  async removeSuperAdmin(inboxId: InboxId): Promise<void> {
    return XMTP.removeSuperAdmin(this.client.installationId, this.id, inboxId)
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the addMember permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateAddMemberPermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateAddMemberPermission(
      this.client.installationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the removeMember permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateRemoveMemberPermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateRemoveMemberPermission(
      this.client.installationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the addAdmin permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateAddAdminPermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateAddAdminPermission(
      this.client.installationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the removeAdmin permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateRemoveAdminPermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateRemoveAdminPermission(
      this.client.installationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the groupName permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateNamePermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateGroupNamePermission(
      this.client.installationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the groupImageUrl permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateImageUrlPermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateGroupImageUrlPermission(
      this.client.installationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the groupDescription permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateDescriptionPermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateGroupDescriptionPermission(
      this.client.installationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @returns {Promise<PermissionPolicySet>} A {PermissionPolicySet} object representing the group's permission policy set.
   */
  async permissionPolicySet(): Promise<PermissionPolicySet> {
    return XMTP.permissionPolicySet(this.client.installationId, this.id)
  }

  async processMessage(
    encryptedMessage: string
  ): Promise<DecodedMessage<ContentTypes[number]>> {
    try {
      return await XMTP.processMessage(
        this.client.installationId,
        this.id,
        encryptedMessage
      )
    } catch (e) {
      console.info('ERROR in processGroupMessage()', e)
      throw e
    }
  }

  async consentState(): Promise<ConsentState> {
    return await XMTP.conversationConsentState(
      this.client.installationId,
      this.id
    )
  }

  async updateConsent(state: ConsentState): Promise<void> {
    return await XMTP.updateConversationConsent(
      this.client.installationId,
      this.id,
      state
    )
  }

  /**
   *
   * @returns {Promise<Member[]>} A Promise that resolves to an array of Member objects.
   * To get the latest member list from the network, call sync() first.
   */
  async members(): Promise<Member[]> {
    return await XMTP.listConversationMembers(
      this.client.installationId,
      this.id
    )
  }

  /**
   *
   * @returns {Promise<String>} A Promise that resolves to null unless
   * the group is paused because of a minimum libxmtp version for the group.
   * If the group is paused, the Promise resolves to the version string of the libxmtp
   * that is required to join the group.
   */
  async pausedForVersion(): Promise<string> {
    return await XMTP.pausedForVersion(this.client.installationId, this.id)
  }

  /**
   * @returns {Promise<keystore.GetConversationHmacKeysResponse>} A Promise that resolves to a list
   * of hmac keys for this conversation that can be used to filter out self push notifications.
   */
  async getConversationHmacKeys(): Promise<keystore.GetConversationHmacKeysResponse> {
    return await XMTP.getConversationHmacKeys(
      this.client.installationId,
      this.id
    )
  }

  /**
   * @returns {Promise<ConversationTopic[]>} A Promise that resolves to a list
   * of conversation topics that can be used to subscribe to push notifications.
   */
  async getConversationPushTopics(): Promise<ConversationTopic[]> {
    return await XMTP.getConversationPushTopics(
      this.client.installationId,
      this.id
    )
  }

  /**
   * @returns {Promise<ConversationDebugInfo>} A Promise that resolves to debug
   * information that can help debug issues with the conversation
   */
  async getDebugInformation(): Promise<ConversationDebugInfo> {
    return await XMTP.getDebugInformation(this.client.installationId, this.id)
  }
}
