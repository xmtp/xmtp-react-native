import { keystore } from '@xmtp/proto'
import { Subscription } from 'expo-modules-core'

import { Client, InboxId } from './Client'
import { ConsentState } from './ConsentRecord'
import { ConversationVersion, ConversationBase } from './Conversation'
import { DecodedMessage } from './DecodedMessage'
import { Member } from './Member'
import * as XMTP from '../index'
import {
  ConversationDebugInfo,
  ConversationId,
  ConversationTopic,
  DisappearingMessageSettings,
} from '../index'
import { CommitLogForkStatus } from './ConversationDebugInfo'
import { ConversationSendPayload } from './types/ConversationCodecs'
import { DecodedMessageUnion } from './types/DecodedMessageUnion'
import { DefaultContentTypes } from './types/DefaultContentType'
import { EventTypes } from './types/EventTypes'
import { MessageId, MessagesOptions } from './types/MessagesOptions'
import { SendOptions } from './types/SendOptions'

export interface DmParams {
  id: ConversationId
  createdAt: number
  topic: ConversationTopic
  consentState: ConsentState
  lastMessage?: DecodedMessage
  commitLogForkStatus?: CommitLogForkStatus
}

export class Dm<ContentTypes extends DefaultContentTypes = DefaultContentTypes>
  implements ConversationBase<ContentTypes>
{
  client: Client<ContentTypes>
  id: ConversationId
  createdAt: number
  version = ConversationVersion.DM as const
  topic: ConversationTopic
  state: ConsentState
  lastMessage?: DecodedMessageUnion<ContentTypes>
  commitLogForkStatus?: CommitLogForkStatus

  constructor(
    client: Client<ContentTypes>,
    params: DmParams,
    lastMessage?: DecodedMessageUnion<ContentTypes>
  ) {
    this.client = client
    this.id = params.id
    this.createdAt = params.createdAt
    this.topic = params.topic
    this.state = params.consentState
    this.lastMessage = lastMessage
    this.commitLogForkStatus = params.commitLogForkStatus
  }

  /**
   * This method return the peer inbox id associated with the dm.
   * @returns {Promise<InboxId>} A Promise that resolves to a InboxId.
   */
  async peerInboxId(): Promise<InboxId> {
    return XMTP.dmPeerInboxId(this.client.installationId, this.id)
  }

  /**
   * Sends a message to the current dm.
   *
   * @param {string | MessageContent} content - The content of the message. It can be either a string or a structured MessageContent object.
   * @returns {Promise<string>} A Promise that resolves to a string identifier for the sent message.
   * @throws {Error} Throws an error if there is an issue with sending the message.
   */
  async send<SendContentTypes extends DefaultContentTypes = ContentTypes>(
    content: ConversationSendPayload<SendContentTypes>,
    opts?: SendOptions
  ): Promise<MessageId> {
    if (opts && opts.contentType) {
      return await this._sendWithJSCodec(
        content,
        opts.contentType,
        opts.shouldPush
      )
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
    contentType: XMTP.ContentTypeId,
    shouldPush?: boolean
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
      codec,
      shouldPush ?? codec.shouldPush(content) ?? true
    )
  }

  /**
   * Prepare a dm message to be sent.
   *
   * @param {string | MessageContent} content - The content of the message. It can be either a string or a structured MessageContent object.
   * @param {SendOptions} opts - The options for the message.
   * @param {boolean} noSend - When true, the prepared message will not be published until
   *               [publishMessage] is called with the returned message ID.
   *               When false (default), uses optimistic sending and the message
   *               will be published with the next [publishMessages] call.   * @returns {Promise<string>} A Promise that resolves to a string identifier for the prepared message to be sent.
   * @throws {Error} Throws an error if there is an issue with sending the message.
   */
  async prepareMessage<
    SendContentTypes extends DefaultContentTypes = ContentTypes,
  >(
    content: ConversationSendPayload<SendContentTypes>,
    opts?: SendOptions,
    noSend?: boolean
  ): Promise<MessageId> {
    if (opts && opts.contentType) {
      return await this._prepareWithJSCodec(content, opts.contentType, noSend)
    }

    try {
      if (typeof content === 'string') {
        content = { text: content }
      }

      return await XMTP.prepareMessage(
        this.client.installationId,
        this.id,
        content,
        noSend ?? false
      )
    } catch (e) {
      console.info('ERROR in prepareMessage()', e.message)
      throw e
    }
  }

  private async _prepareWithJSCodec<T>(
    content: T,
    contentType: XMTP.ContentTypeId,
    noSend?: boolean
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
      codec,
      noSend ?? false
    )
  }

  /**
   * Publishes a message that was prepared with noSend = true.
   * @param {MessageId} messageId The id of the message to publish.
   * @returns {Promise<void>} A Promise that resolves when the message is published.
   */
  publishMessage(messageId: MessageId): Promise<void> {
    return XMTP.publishMessage(this.client.installationId, this.id, messageId)
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
   * This method returns an array of messages associated with the dm.
   * To get the latest messages from the network, call sync() first.
   *
   * @param {number | undefined} limit - Optional maximum number of messages to return.
   * @param {number | undefined} before - Optional filter for specifying the maximum timestamp of messages to return.
   * @param {number | undefined} after - Optional filter for specifying the minimum timestamp of messages to return.
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
      opts?.direction,
      opts?.excludeContentTypes,
      opts?.excludeSenderInboxIds
    )
  }

  /**
   * This method returns an array of messages associated with the dm.
   * To get the latest messages from the network, call sync() first.
   *
   * @param {number | undefined} limit - Optional maximum number of messages to return.
   * @param {number | undefined} before - Optional filter for specifying the maximum timestamp of messages to return.
   * @param {number | undefined} after - Optional filter for specifying the minimum timestamp of messages to return.
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
      opts?.direction,
      opts?.excludeContentTypes,
      opts?.excludeSenderInboxIds
    )
  }

  /**
   * Executes a network request to fetch the latest messages and membership changes
   * associated with the dm and saves them to the local state.
   */
  async sync() {
    await XMTP.syncConversation(this.client.installationId, this.id)
  }

  /**
   * Sets up a real-time message stream for the current dm.
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

  async processMessage(
    encryptedMessage: string
  ): Promise<DecodedMessageUnion<ContentTypes>> {
    try {
      return await XMTP.processMessage(
        this.client.installationId,
        this.id,
        encryptedMessage
      )
    } catch (e) {
      console.info('ERROR in processConversationMessage()', e)
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
   * the dm is paused because of a minimum libxmtp version for the dm.
   * If the dm is paused, the Promise resolves to the version string of the libxmtp
   * that is required to join the dm.
   */
  async pausedForVersion(): Promise<string> {
    return await XMTP.pausedForVersion(this.client.installationId, this.id)
  }

  /**
   * Returns whether the dm is active.
   * To get the latest active status from the network, call sync() first
   * @returns {Promise<boolean>} A Promise that resolves if the group is active or not
   */

  async isActive(): Promise<boolean> {
    return XMTP.isActive(this.client.installationId, this.id)
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

  /**
   * Deletes a message from the dm. You must be the sender of the message or a super admin of the conversation in order to delete the message.
   * @param {MessageId} messageId The id of the message to delete.
   * @returns {Promise<string>} A Promise that resolves to the id of the deleted message.
   */
  async deleteMessage(messageId: MessageId): Promise<string> {
    return await XMTP.deleteMessage(
      this.client.installationId,
      this.id,
      messageId
    )
  }
}
