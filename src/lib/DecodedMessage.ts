import { Client } from './Client'
import {
  ContentCodec,
  JSContentCodec,
  NativeContentCodec,
  NativeMessageContent,
} from './ContentCodec'
import { ReplyCodec } from './NativeCodecs/ReplyCodec'
import { TextCodec } from './NativeCodecs/TextCodec'

export class DecodedMessage<T> {
  client: Client
  id: string
  topic: string
  contentTypeId: string
  senderAddress: string
  sent: number // timestamp in milliseconds
  nativeContent: NativeMessageContent
  fallback: string | undefined
  codec: ContentCodec<T>

  static from<T>(json: string, client: Client): DecodedMessage<T> {
    const decoded = JSON.parse(json)
    return new DecodedMessage(
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

  static fromObject<T>(
    object: {
      id: string
      topic: string
      contentTypeId: string
      senderAddress: string
      sent: number // timestamp in milliseconds
      content: any
      fallback: string | undefined
    },
    client: Client
  ): DecodedMessage<T> {
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
    client: Client,
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
    this.fallback = fallback
    this.codec = client.codecRegistry[contentTypeId] as ContentCodec<T>
  }

  content(): T {
    const encodedJSON = this.nativeContent.encoded
    if (encodedJSON) {
      const encoded = JSON.parse(encodedJSON)
      const codec = this.client.codecRegistry[
        this.contentTypeId
      ] as JSContentCodec<T>

      return codec.decode(encoded)
    } else {
      for (const nativeCodec of [new TextCodec(), new ReplyCodec()]) {
        if (this.nativeContent[nativeCodec.contentKey]) {
          return (nativeCodec as NativeContentCodec<T>).decode(
            this.nativeContent
          )
        }
      }

      throw new Error('no content type found')
    }
  }
}
