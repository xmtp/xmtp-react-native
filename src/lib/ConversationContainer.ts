import { ConsentState } from './ConsentListEntry'
import { DefaultContentTypes } from './types/DefaultContentType'
import * as XMTP from '../index'
import { DecodedMessage } from '../index'

export enum ConversationVersion {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
  DM = 'DM',
}

export interface ConversationContainer<
  ContentTypes extends DefaultContentTypes,
> {
  client: XMTP.Client<ContentTypes>
  createdAt: number
  topic: string
  version: ConversationVersion
  id: string
  state: ConsentState
  lastMessage?: DecodedMessage<ContentTypes>
}

export interface ConversationFunctions<
  ContentTypes extends DefaultContentTypes,
> {
  sendMessage(content: string): Promise<void>;
  loadMessages(limit?: number): Promise<DecodedMessage<ContentTypes>[]>;
  updateState(state: ConsentState): void;
}