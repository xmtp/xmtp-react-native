import { Buffer } from 'buffer'

import { Client } from './Client'
import {
  JSContentCodec,
  NativeContentCodec,
  NativeMessageContent,
} from './ContentCodec'

const allowEmptyProperties: (keyof NativeMessageContent)[] = [
  'text',
  'readReceipt',
]
export class DecodedMessage<ContentTypes = any> {
  client: Client<ContentTypes>
  id: string
  topic: string
  contentTypeId: string
  senderAddress: string
  sent: number // timestamp in milliseconds
  nativeContent: NativeMessageContent
  fallback: string | undefined

  static from<ContentTypes>(
    json: string,
    client: Client<ContentTypes>
  ): DecodedMessage {
    const decoded = JSON.parse(json)
    return new DecodedMessage<ContentTypes>(
      client,
      decoded.id,
      decoded.topic,
      decoded.contentTypeId,
      decoded.senderAddress,
      decoded.sent,
      decoded.content,
      decoded.fallback
    )
  }

  static fromObject<ContentTypes>(
    object: {
      id: string
      topic: string
      contentTypeId: string
      senderAddress: string
      sent: number // timestamp in milliseconds
      content: any
      fallback: string | undefined
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
      object.fallback
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
    fallback: string | undefined
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
  }

  content(): ContentTypes {
    const encodedJSON = this.nativeContent.encoded
    if (encodedJSON) {
      const encoded = JSON.parse(encodedJSON)
      const codec = this.client.codecRegistry[
        this.contentTypeId
      ] as JSContentCodec<ContentTypes>
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
          return (codec as NativeContentCodec<ContentTypes>).decode(
            this.nativeContent
          )
        }
      }

      throw new Error(
        `no content type found ${JSON.stringify(this.nativeContent)}`
      )
    }
  }
}
