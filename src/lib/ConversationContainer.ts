import { DefaultContentTypes } from './types/DefaultContentType'
import * as XMTP from '../index'

export enum ConversationVersion {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}

export interface ConversationContainer<
  ContentTypes extends DefaultContentTypes,
> {
  client: XMTP.Client<ContentTypes>
  createdAt: number
  topic: string
  version: ConversationVersion
}
