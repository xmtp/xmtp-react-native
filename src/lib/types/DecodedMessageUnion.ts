import { DefaultContentTypes } from './DefaultContentType'
import { ContentCodec } from '../ContentCodec'
import { DecodedMessage } from '../DecodedMessage'
import { DecodedMessageV2 } from '../DecodedMessageV2'

export type DecodedMessageUnion<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> = {
  [K in keyof ContentTypes]: ContentTypes[K] extends ContentCodec<any>
    ? DecodedMessage<ContentTypes[K]>
    : never
}[number]

export type DecodedMessageUnionV2<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> = {
  [K in keyof ContentTypes]: ContentTypes[K] extends ContentCodec<any>
    ? DecodedMessageV2<ContentTypes[K]>
    : never
}[number]
