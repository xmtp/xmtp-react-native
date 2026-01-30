import { Buffer } from 'buffer'

import { Client, ExtractDecodedType, InboxId } from './Client'
import {
  ContentTypeId,
  JSContentCodec,
  NativeContentCodec,
  NativeMessageContent,
  contentTypeIdToString,
} from './ContentCodec'
import { MessageDeliveryStatus } from './DecodedMessage'
import { ConversationId, MessageId } from './types'
import {
  DecodedMessageUnionV2,
} from './types/DecodedMessageUnion'
import { DefaultContentTypes } from './types/DefaultContentType'

const allowEmptyProperties: (keyof NativeMessageContent)[] = [
  'text',
  'readReceipt',
]

export class DecodedMessageV2<
  ContentType extends DefaultContentTypes[number] = DefaultContentTypes[number],
> {
  id: MessageId
  conversationId: ConversationId
  senderInboxId: InboxId
  sentAt: Date
  sentAtNs: number // timestamp in nanoseconds
  insertedAtNs: number
  expiresAtNs: number | undefined
  expiresAt: Date | undefined
  deliveryStatus: MessageDeliveryStatus
  reactions: DecodedMessageV2<ContentType>[]
  hasReactions: boolean
  reactionCount: number
  fallbackText: string | undefined
  contentTypeId: ContentTypeId
  nativeContent: NativeMessageContent

  static from<
    ContentType extends
      DefaultContentTypes[number] = DefaultContentTypes[number],
    ContentTypes extends DefaultContentTypes = ContentType[],
  >(json: string): DecodedMessageUnionV2<ContentTypes> {
    const decoded = JSON.parse(json)
    if (!decoded) {
      throw new Error('Tried to parse null as a DecodedMessage')
    }
    // Parse any child messages recursively
    const reactions = decoded.reactions?.map((reactionJson: any) =>
      DecodedMessageV2.fromObject<ContentType>({
        ...reactionJson,
        deliveryStatus: reactionJson.deliveryStatus,
      })
    )
    return new DecodedMessageV2<ContentType>(
      decoded.id,
      decoded.conversationId,
      decoded.senderInboxId,
      decoded.sentAt,
      decoded.sentAtNs,
      decoded.insertedAtNs,
      decoded.expiresAtNs,
      decoded.expiresAt,
      decoded.deliveryStatus,
      reactions ?? [],
      decoded.hasReactions,
      decoded.reactionCount,
      decoded.fallbackText,
      decoded.contentTypeId,
      decoded.nativeContent
    ) as DecodedMessageUnionV2<ContentTypes>
  }

  static fromObject<
    ContentType extends
      DefaultContentTypes[number] = DefaultContentTypes[number],
  >(object: {
    id: MessageId
    conversationId: ConversationId
    senderInboxId: InboxId
    sentAt: Date
    sentAtNs: number // timestamp in nanoseconds
    insertedAtNs: number
    expiresAtNs: number | undefined
    expiresAt: Date | undefined
    deliveryStatus: MessageDeliveryStatus
    reactions: DecodedMessageV2<ContentType>[]
    hasReactions: boolean
    reactionCount: number
    fallbackText: string | undefined
    contentTypeId: ContentTypeId
    nativeContent: NativeMessageContent
  }): DecodedMessageV2<ContentType> {
    return new DecodedMessageV2(
      object.id,
      object.conversationId,
      object.senderInboxId,
      object.sentAt,
      object.sentAtNs,
      object.insertedAtNs,
      object.expiresAtNs,
      object.expiresAt,
      object.deliveryStatus,
      object.reactions,
      object.hasReactions,
      object.reactionCount,
      object.fallbackText,
      object.contentTypeId,
      object.nativeContent
    )
  }

  constructor(
    id: MessageId,
    conversationId: ConversationId,
    senderInboxId: InboxId,
    sentAt: Date,
    sentAtNs: number, // timestamp in nanoseconds
    insertedAtNs: number,
    expiresAtNs: number | undefined,
    expiresAt: Date | undefined,
    deliveryStatus: MessageDeliveryStatus,
    reactions: DecodedMessageV2<ContentType>[],
    hasReactions: boolean,
    reactionCount: number,
    fallbackText: string | undefined,
    contentTypeId: ContentTypeId,
    nativeContent: NativeMessageContent
  ) {
    this.id = id
    this.conversationId = conversationId
    this.senderInboxId = senderInboxId
    this.sentAt = sentAt
    this.sentAtNs = sentAtNs
    this.insertedAtNs = insertedAtNs
    this.expiresAtNs = expiresAtNs
    this.expiresAt = expiresAt
    this.deliveryStatus = deliveryStatus
    this.reactions = reactions
    this.hasReactions = hasReactions
    this.reactionCount = reactionCount
    this.fallbackText = fallbackText
    this.contentTypeId = contentTypeId
    this.nativeContent = nativeContent
  }

  content(): ExtractDecodedType<ContentType> {
    const encodedJSON = this.nativeContent.encoded
    if (encodedJSON) {
      const encoded = JSON.parse(encodedJSON)
      const codec = Client.codecRegistry[
        contentTypeIdToString(this.contentTypeId)
      ] as JSContentCodec<ExtractDecodedType<ContentType>>
      if (!codec) {
        throw new Error(
          `no content type found ${JSON.stringify(this.contentTypeId)}`
        )
      }
      if (encoded.content) {
        encoded.content = new Uint8Array(Buffer.from(encoded.content, 'base64'))
      }
      return codec.decode(encoded)
    } else if (this.nativeContent.unknown) {
      // Handle unknown/custom content types from DecodedMessageV2
      // The native layer returns {"unknown": {"contentTypeId": "...", "content": "..."}}
      //
      // LIMITATION: Unlike regular messages(), the native FFI layer for enrichedMessages()
      // already decodes the content before sending it to JS. This means:
      // 1. We cannot call JSContentCodec.decode() because it expects raw EncodedContent
      // 2. Any transformations a codec does in decode() will NOT be applied
      // 3. The content is returned as-is from the FFI layer (just JSON parsed)
      //
      // For custom content types that need transformation in decode(), use messages() instead.
      const unknownContent = this.nativeContent.unknown
      const contentTypeIdStr =
        unknownContent.contentTypeId ??
        contentTypeIdToString(this.contentTypeId)

      // Verify we have a codec registered for this content type
      const codec = Client.codecRegistry[contentTypeIdStr]
      if (!codec) {
        throw new Error(
          `no content type found for unknown content: ${JSON.stringify(this.nativeContent)}`
        )
      }

      // The content is already decoded by FFI and JSON-stringified
      // We can only return it as-is - codec.decode() cannot be used here
      if (unknownContent.content) {
        return JSON.parse(
          unknownContent.content
        ) as ExtractDecodedType<ContentType>
      }
      throw new Error(
        `unknown content has no content field: ${JSON.stringify(this.nativeContent)}`
      )
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
