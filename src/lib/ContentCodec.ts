import { content } from '@xmtp/proto'

export type EncodedContent = content.EncodedContent
export type ContentTypeId = content.ContentTypeId

// Native Content Codecs have two generic types:

export interface JSContentCodec<T> {
  contentType: ContentTypeId
  encode(content: T): EncodedContent
  decode(encodedContent: EncodedContent): T
  fallback(content: T): string | undefined
}

export type ContentCodec = JSContentCodec<any>
