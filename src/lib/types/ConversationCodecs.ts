import { ContentCodec } from './ContentCodec'
import { ExtractDecodedType } from './ExtractDecodedType'
import { TextCodec } from '../NativeCodecs/TextCodec'

export type WithTextContentCode = { text: string }
export type ContentCodecMap<ContentTypes extends ContentCodec<any>> =
  ContentTypes extends infer T
    ? T extends { contentKey: infer K }
      ? { [key in K extends string ? K : never]: ExtractDecodedType<T> }
      : ExtractDecodedType<T>
    : never

export type ConversationSendPayload<ContentTypes extends ContentCodec<any>[]> =
  | ContentCodecMap<ContentTypes[number] | TextCodec>
  | string
