import { ContentTypeId } from './types/ContentCodec'
import { DefaultContentTypes } from './types/DefaultContentType'
import * as XMTP from '../index'

export type SendOptions = {
  contentType?: ContentTypeId
}

export enum ConversationVersion {
  V1 = 'v1',
  V2 = 'v2',
  GROUP = 'group',
}

export interface IConversation<ContentTypes extends DefaultContentTypes> {
  client: XMTP.Client<ContentTypes>
  createdAt: number
  version: ConversationVersion
  topic: string
  isGroup(): boolean
}
