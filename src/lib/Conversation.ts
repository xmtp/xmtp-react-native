import { keystore } from '@xmtp/proto'

import { ConsentState } from './ConsentRecord'
import {
  ConversationSendPayload,
  ConversationTopic,
  MessageId,
  MessagesOptions,
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
import { DecodedMessageUnion } from './types/DecodedMessageUnion'
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

  send<SendContentTypes extends DefaultContentTypes = ContentTypes>(
    content: ConversationSendPayload<SendContentTypes>,
    opts?: SendOptions
  ): Promise<MessageId>
  prepareMessage<SendContentTypes extends DefaultContentTypes = ContentTypes>(
    content: ConversationSendPayload<SendContentTypes>,
    opts?: SendOptions
  ): Promise<MessageId>
  sync()
  messages(opts?: MessagesOptions): Promise<DecodedMessageUnion<ContentTypes>[]>
  streamMessages(
    callback: (message: DecodedMessage<ContentTypes[number]>) => Promise<void>,
    onClose?: () => void
  ): Promise<() => void>
  consentState(): Promise<ConsentState>
  updateConsent(state: ConsentState): Promise<void>
  disappearingMessageSettings(): Promise<
    DisappearingMessageSettings | undefined
  >
  isDisappearingMessagesEnabled(): Promise<boolean>
  clearDisappearingMessageSettings(): Promise<void>
  updateDisappearingMessageSettings(
    disappearingMessageSettings: DisappearingMessageSettings
  ): Promise<void>
  processMessage(
    encryptedMessage: string
  ): Promise<DecodedMessage<ContentTypes[number]>>
  members(): Promise<Member[]>
  pausedForVersion(): Promise<string>
  getConversationHmacKeys(): Promise<keystore.GetConversationHmacKeysResponse>
  getConversationPushTopics(): Promise<ConversationTopic[]>
  getDebugInformation(): Promise<ConversationDebugInfo>
}

export type Conversation<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> = Group<ContentTypes> | Dm<ContentTypes>
