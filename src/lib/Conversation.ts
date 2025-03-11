import { ConsentState } from './ConsentRecord'
import {
  ConversationSendPayload,
  MessageId,
  MessagesOptions,
  SendOptions,
} from './types'
import { DecodedMessageUnion } from './types/DecodedMessageUnion'
import { DefaultContentTypes } from './types/DefaultContentType'
import {
  DecodedMessage,
  Member,
  Dm,
  Group,
  Client,
  DisappearingMessageSettings,
} from '../index'

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
    callback: (message: DecodedMessage<ContentTypes[number]>) => Promise<void>
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
}

export type Conversation<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> = Group<ContentTypes> | Dm<ContentTypes>
