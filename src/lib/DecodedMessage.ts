import { Buffer } from 'buffer'

import { Client, ExtractDecodedType, InboxId } from './Client'
import {
  JSContentCodec,
  NativeContentCodec,
  NativeMessageContent,
} from './ContentCodec'
import { ConversationTopic, MessageId } from './types'
import { DecodedMessageUnion } from './types/DecodedMessageUnion'
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
  ContentType extends DefaultContentTypes[number] = DefaultContentTypes[number],
> {
  id: MessageId
  topic: ConversationTopic
  contentTypeId: string
  senderInboxId: InboxId
  sentNs: number // timestamp in nanoseconds
  nativeContent: NativeMessageContent
  fallback: string | undefined
  deliveryStatus: MessageDeliveryStatus = MessageDeliveryStatus.PUBLISHED
  childMessages?: DecodedMessage<ContentType>[]

  static from<
    ContentType extends
      DefaultContentTypes[number] = DefaultContentTypes[number],
    ContentTypes extends DefaultContentTypes = ContentType[],
  >(json: string): DecodedMessageUnion<ContentTypes> {
    const decoded = JSON.parse(json)
    // Parse any child messages recursively
    const childMessages = decoded.childMessages?.map((childJson: any) =>
      DecodedMessage.fromObject<ContentType>({
        ...childJson,
        deliveryStatus: childJson.deliveryStatus,
      })
    )
    return new DecodedMessage<ContentType>(
      decoded.id,
      decoded.topic,
      decoded.contentTypeId,
      decoded.senderInboxId,
      decoded.sentNs,
      decoded.content,
      decoded.fallback,
      decoded.deliveryStatus,
      childMessages
    ) as DecodedMessageUnion<ContentTypes>
  }

  static fromObject<
    ContentType extends
      DefaultContentTypes[number] = DefaultContentTypes[number],
  >(object: {
    id: MessageId
    topic: ConversationTopic
    contentTypeId: string
    senderInboxId: InboxId
    sentNs: number // timestamp in nanoseconds
    content: any
    fallback: string | undefined
    deliveryStatus: MessageDeliveryStatus | undefined
  }): DecodedMessage<ContentType> {
    return new DecodedMessage(
      object.id,
      object.topic,
      object.contentTypeId,
      object.senderInboxId,
      object.sentNs,
      object.content,
      object.fallback,
      object.deliveryStatus
    )
  }

  constructor(
    id: MessageId,
    topic: ConversationTopic,
    contentTypeId: string,
    senderInboxId: InboxId,
    sentNs: number,
    content: any,
    fallback: string | undefined,
    deliveryStatus: MessageDeliveryStatus = MessageDeliveryStatus.PUBLISHED,
    childMessages?: DecodedMessage<ContentType>[]
  ) {
    this.id = id
    this.topic = topic
    this.contentTypeId = contentTypeId
    this.senderInboxId = senderInboxId
    this.sentNs = sentNs
    this.nativeContent = content
    // undefined comes back as null when bridged, ensure undefined so integrators don't have to add a new check for null as well
    this.fallback = fallback ?? undefined
    this.deliveryStatus = deliveryStatus
    this.childMessages = childMessages
  }

  content(): ExtractDecodedType<ContentType> {
    const encodedJSON = this.nativeContent.encoded
    if (encodedJSON) {
      const encoded = JSON.parse(encodedJSON)
      const codec = Client.codecRegistry[this.contentTypeId] as JSContentCodec<
        ExtractDecodedType<ContentType>
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
      for (const codec of Object.values(Client.codecRegistry)) {
        if (
          ('contentKey' in codec && this.nativeContent[codec.contentKey]) ||
          allowEmptyProperties.some((prop) =>
            this.nativeContent.hasOwnProperty(prop)
          )
        ) {
          return (
            codec as NativeContentCodec<ExtractDecodedType<ContentType>>
          ).decode(this.nativeContent)
        }
      }

      throw new Error(
        `no content type found ${JSON.stringify(this.nativeContent)}`
      )
    }
  }
}
