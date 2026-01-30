import { keystore } from '@xmtp/proto'

import { ConsentState } from './ConsentRecord'
import {
  ConversationSendPayload,
  ConversationTopic,
  MessageId,
  MessagesOptions,
  EnrichedMessagesOptions,
  SendOptions,
} from './types'
import {
  DecodedMessage,
  Member,
  Dm,
  Group,
  Client,
  DisappearingMessageSettings,
  ConversationDebugInfo,
} from '../index'
import { CommitLogForkStatus } from './ConversationDebugInfo'
import {
  DecodedMessageUnion,
  DecodedMessageUnionV2,
} from './types/DecodedMessageUnion'
import { DefaultContentTypes } from './types/DefaultContentType'

export enum ConversationVersion {
  GROUP = 'GROUP',
  DM = 'DM',
}

export interface ConversationBase<ContentTypes extends DefaultContentTypes> {
  client: Client<ContentTypes>
  createdAt: number
  topic: string
  version: ConversationVersion
  id: string
  state: ConsentState
  lastMessage?: DecodedMessage<ContentTypes[number]>
  commitLogForkStatus?: CommitLogForkStatus

  /**
   * Sends a message to the conversation.
   *
   * @param {ConversationSendPayload} content - The content of the message to send.
   * @param {SendOptions} opts - Optional send options.
   * @returns {Promise<MessageId>} A Promise that resolves to the ID of the sent message.
   */
  send<SendContentTypes extends DefaultContentTypes = ContentTypes>(
    content: ConversationSendPayload<SendContentTypes>,
    opts?: SendOptions
  ): Promise<MessageId>

  /**
   * Prepares a message to be sent, storing it locally.
   *
   * @param {ConversationSendPayload} content - The content of the message to prepare.
   * @param {SendOptions} opts - Optional send options.
   * @param {boolean} noSend - If true, the message will only be sent when publishMessage is called.
   * @returns {Promise<MessageId>} A Promise that resolves to the ID of the prepared message.
   */
  prepareMessage<SendContentTypes extends DefaultContentTypes = ContentTypes>(
    content: ConversationSendPayload<SendContentTypes>,
    opts?: SendOptions,
    noSend?: boolean
  ): Promise<MessageId>

  /**
   * Publishes a previously prepared message.
   *
   * @param {MessageId} messageId - The ID of the prepared message to publish.
   * @returns {Promise<void>}
   */
  publishMessage(messageId: MessageId): Promise<void>

  /**
   * Synchronizes the conversation with the network to fetch the latest messages.
   */
  sync(): Promise<void>

  /**
   * Returns an array of messages associated with the conversation.
   * To get the latest messages from the network, call sync() first.
   *
   * @param {MessagesOptions} opts - Optional parameters for filtering messages.
   * @returns {Promise<DecodedMessageUnion<ContentTypes>[]>} A Promise that resolves to an array of DecodedMessage objects.
   */
  messages(opts?: MessagesOptions): Promise<DecodedMessageUnion<ContentTypes>[]>

  /**
   * Returns an array of enriched messages (V2) associated with the conversation.
   * Enriched messages include additional metadata like reactions, delivery status, and more.
   * To get the latest messages from the network, call sync() first.
   *
   * @param {EnrichedMessagesOptions} opts - Optional parameters for filtering messages.
   * @returns {Promise<DecodedMessageUnionV2<ContentTypes>[]>} A Promise that resolves to an array of DecodedMessageV2 objects.
   */
  enrichedMessages(
    opts?: EnrichedMessagesOptions
  ): Promise<DecodedMessageUnionV2<ContentTypes>[]>

  /**
   * Sets up a real-time message stream for the conversation.
   *
   * @param {Function} callback - A callback function to be invoked when a message is received.
   * @param {Function} onClose - Optional callback when the stream is closed.
   * @returns {Promise<() => void>} A function that can be called to cancel the message stream.
   */
  streamMessages(
    callback: (message: DecodedMessage<ContentTypes[number]>) => Promise<void>,
    onClose?: () => void
  ): Promise<() => void>

  /**
   * Returns the current consent state of the conversation.
   *
   * @returns {Promise<ConsentState>} The consent state ('allowed', 'denied', or 'unknown').
   */
  consentState(): Promise<ConsentState>

  /**
   * Updates the consent state of the conversation.
   *
   * @param {ConsentState} state - The new consent state to set.
   * @returns {Promise<void>}
   */
  updateConsent(state: ConsentState): Promise<void>

  /**
   * Returns the disappearing message settings for the conversation.
   *
   * @returns {Promise<DisappearingMessageSettings | undefined>} The settings, or undefined if not enabled.
   */
  disappearingMessageSettings(): Promise<
    DisappearingMessageSettings | undefined
  >

  /**
   * Checks if disappearing messages are enabled for the conversation.
   *
   * @returns {Promise<boolean>} True if disappearing messages are enabled.
   */
  isDisappearingMessagesEnabled(): Promise<boolean>

  /**
   * Checks if the conversation is active.
   *
   * @returns {Promise<boolean>} True if the conversation is active.
   */
  isActive(): Promise<boolean>

  /**
   * Clears the disappearing message settings for the conversation.
   *
   * @returns {Promise<void>}
   */
  clearDisappearingMessageSettings(): Promise<void>

  /**
   * Updates the disappearing message settings for the conversation.
   *
   * @param {DisappearingMessageSettings} disappearingMessageSettings - The new settings to apply.
   * @returns {Promise<void>}
   */
  updateDisappearingMessageSettings(
    disappearingMessageSettings: DisappearingMessageSettings
  ): Promise<void>

  /**
   * Processes an encrypted message received via push notification.
   *
   * @param {string} encryptedMessage - The encrypted message to process.
   * @returns {Promise<DecodedMessage<ContentTypes[number]>>} The decoded message.
   */
  processMessage(
    encryptedMessage: string
  ): Promise<DecodedMessage<ContentTypes[number]>>

  /**
   * Returns the list of members in the conversation.
   *
   * @returns {Promise<Member[]>} An array of Member objects.
   */
  members(): Promise<Member[]>

  /**
   * Returns the version number if the conversation is paused due to a version mismatch.
   *
   * @returns {Promise<string>} The version string, or null if not paused.
   */
  pausedForVersion(): Promise<string>

  /**
   * Returns the HMAC keys for the conversation (used for push notifications).
   *
   * @returns {Promise<keystore.GetConversationHmacKeysResponse>}
   */
  getConversationHmacKeys(): Promise<keystore.GetConversationHmacKeysResponse>

  /**
   * Returns the push notification topics for the conversation.
   *
   * @returns {Promise<ConversationTopic[]>}
   */
  getConversationPushTopics(): Promise<ConversationTopic[]>

  /**
   * Returns debug information about the conversation.
   *
   * @returns {Promise<ConversationDebugInfo>}
   */
  getDebugInformation(): Promise<ConversationDebugInfo>

  /**
   * Deletes a message from the conversation.
   *
   * @param {MessageId} messageId - The ID of the message to delete.
   * @returns {Promise<string>} The ID of the deletion message.
   */
  deleteMessage(messageId: MessageId): Promise<string>
}

export type Conversation<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> = Group<ContentTypes> | Dm<ContentTypes>
