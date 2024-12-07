import { DefaultContentTypes } from './DefaultContentType'
import { ContentCodec } from '../ContentCodec'
import { DecodedMessage } from '../DecodedMessage'

export type DecodedMessageUnion<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> = {
  [K in keyof ContentTypes]: ContentTypes[K] extends ContentCodec<any>
    ? DecodedMessage<ContentTypes[K], ContentTypes>
    : never
}[number]
