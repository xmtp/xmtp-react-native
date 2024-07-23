import { Buffer } from 'buffer'

import { Client, ExtractDecodedType } from './Client'
import {
  JSContentCodec,
  NativeContentCodec,
  NativeMessageContent,
} from './ContentCodec'
import { TextCodec } from './NativeCodecs/TextCodec'
import { DefaultContentTypes } from './types/DefaultContentType'

const allowEmptyProperties: (keyof NativeMessageContent)[] = [
  'text',
  'readReceipt',
]
export enum MessageDeliveryStatus {
  UNPUBLISHED = 'UNPUBLISHED',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
  ALL = 'ALL',
}

export class DecodedMessage<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> {
  client: Client<ContentTypes>
  id: string
  topic: string
  contentTypeId: string
  senderAddress: string
  sent: number // timestamp in milliseconds
  nativeContent: NativeMessageContent
  fallback: string | undefined
  deliveryStatus: MessageDeliveryStatus = MessageDeliveryStatus.PUBLISHED

  static from<ContentTypes extends DefaultContentTypes = DefaultContentTypes>(
    json: string,
    client: Client<ContentTypes>
  ): DecodedMessage<ContentTypes> {
    const decoded = JSON.parse(json)
    return new DecodedMessage<ContentTypes>(
      client,
      decoded.id,
      decoded.topic,
      decoded.contentTypeId,
      decoded.senderAddress,
      decoded.sent,
      decoded.content,
      decoded.fallback,
      decoded.deliveryStatus
    )
  }

  static fromObject<
    ContentTypes extends DefaultContentTypes = DefaultContentTypes,
  >(
    object: {
      id: string
      topic: string
      contentTypeId: string
      senderAddress: string
      sent: number // timestamp in milliseconds
      content: any
      fallback: string | undefined
      deliveryStatus: MessageDeliveryStatus | undefined
    },
    client: Client<ContentTypes>
  ): DecodedMessage<ContentTypes> {
    return new DecodedMessage(
      client,
      object.id,
      object.topic,
      object.contentTypeId,
      object.senderAddress,
      object.sent,
      object.content,
      object.fallback,
      object.deliveryStatus
    )
  }

  constructor(
    client: Client<ContentTypes>,
    id: string,
    topic: string,
    contentTypeId: string,
    senderAddress: string,
    sent: number,
    content: any,
    fallback: string | undefined,
    deliveryStatus: MessageDeliveryStatus = MessageDeliveryStatus.PUBLISHED
  ) {
    this.client = client
    this.id = id
    this.topic = topic
    this.contentTypeId = contentTypeId
    this.senderAddress = senderAddress
    this.sent = sent
    this.nativeContent = content
    // undefined comes back as null when bridged, ensure undefined so integrators don't have to add a new check for null as well
    this.fallback = fallback ?? undefined
    this.deliveryStatus = deliveryStatus
  }

  content(): ExtractDecodedType<[...ContentTypes, TextCodec][number] | string> {
    const encodedJSON = this.nativeContent.encoded
    if (encodedJSON) {
      const encoded = JSON.parse(encodedJSON)
      const codec = this.client.codecRegistry[
        this.contentTypeId
      ] as JSContentCodec<
        ExtractDecodedType<[...ContentTypes, TextCodec][number]>
      >
      if (!codec) {
        throw new Error(
          `no content type found ${JSON.stringify(this.contentTypeId)}`
        )
      }
      if (encoded.content) {
        encoded.content = new Uint8Array(Buffer.from(encoded.content, 'base64'))
      }
      return codec.decode(encoded)
    } else {
      for (const codec of Object.values(this.client.codecRegistry)) {
        if (
          ('contentKey' in codec && this.nativeContent[codec.contentKey]) ||
          allowEmptyProperties.some((prop) =>
            this.nativeContent.hasOwnProperty(prop)
          )
        ) {
          return (
            codec as NativeContentCodec<
              ExtractDecodedType<[...ContentTypes, TextCodec][number]>
            >
          ).decode(this.nativeContent)
        }
      }

      throw new Error(
        `no content type found ${JSON.stringify(this.nativeContent)}`
      )
    }
  }
}
