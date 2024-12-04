import { ConsentState } from './ConsentRecord'
import { ConversationSendPayload, MessageId, MessagesOptions } from './types'
import { DecodedMessageUnion } from './types/DecodedMessageUnion'
import { DefaultContentTypes } from './types/DefaultContentType'
import * as XMTP from '../index'
import { DecodedMessage, Member, Dm, Group } from '../index'

export enum ConversationVersion {
  GROUP = 'GROUP',
  DM = 'DM',
}

export interface ConversationBase<ContentTypes extends DefaultContentTypes> {
  client: XMTP.Client<ContentTypes>
  createdAt: number
  topic: string
  version: ConversationVersion
  id: string
  state: ConsentState
  lastMessage?: DecodedMessage<ContentTypes[number], ContentTypes>

  send<SendContentTypes extends DefaultContentTypes = ContentTypes>(
    content: ConversationSendPayload<SendContentTypes>
  ): Promise<MessageId>
  sync()
  messages(opts?: MessagesOptions): Promise<DecodedMessageUnion<ContentTypes>[]>
  streamMessages(
    callback: (
      message: DecodedMessage<ContentTypes[number], ContentTypes>
    ) => Promise<void>
  ): Promise<() => void>
  consentState(): Promise<ConsentState>
  updateConsent(state: ConsentState): Promise<void>
  processMessage(
    encryptedMessage: string
  ): Promise<DecodedMessage<ContentTypes[number], ContentTypes>>
  members(): Promise<Member[]>
}

export type Conversation<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> = Group<ContentTypes> | Dm<ContentTypes>
