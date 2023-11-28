import { ContentTypeId } from '@xmtp/proto/ts/dist/types/message_contents/content.pb'

import { Client } from './lib/Client'

export type UnknownContent = {
  contentTypeId: string
}

export type ReadReceiptContent = object

export type ReplyContent = {
  reference: string
  content: any
  contentType: ContentTypeId
}

export type ReactionContent = {
  reference: string
  action: 'added' | 'removed' | 'unknown'
  schema: 'unicode' | 'shortcode' | 'custom' | 'unknown'
  content: string
}

export type StaticAttachmentContent = {
  filename: string
  mimeType: string
  data: string
}

export type DecryptedLocalAttachment = {
  fileUri: string
  mimeType?: string
  filename?: string
}

export type RemoteAttachmentMetadata = {
  filename?: string
  secret: string
  salt: string
  nonce: string
  contentDigest: string
  contentLength?: string
}

export type EncryptedLocalAttachment = {
  encryptedLocalFileUri: string
  metadata: RemoteAttachmentMetadata
}

export type RemoteAttachmentContent = RemoteAttachmentMetadata & {
  scheme: 'https://'
  url: string
}

// This contains a message that has been prepared for sending.
// It contains the message ID and the URI of a local file
// containing the payload that needs to be published.
// See Conversation.sendPreparedMessage() and Client.sendPreparedMessage()
//
// For native integrations (e.g. if you have native code for a robust
// pending-message queue in a background task) you can load the referenced
// `preparedFileUri` as a serialized `PreparedMessage` with the native SDKs.
// The contained `envelopes` can then be directly `.publish()`ed with the native `Client`.
//   e.g. on iOS:
//    let preparedFileUrl = URL(string: preparedFileUri)
//    let preparedData = try Data(contentsOf: preparedFileUrl)
//    let prepared = try PreparedMessage.fromSerializedData(preparedData)
//    try await client.publish(envelopes: prepared.envelopes)
//   e.g. on Android:
//     val preparedFileUri = Uri.parse(preparedFileUri)
//     val preparedData = contentResolver.openInputStream(preparedFileUrl)!!
//         .use { it.buffered().readBytes() }
//     val prepared = PreparedMessage.fromSerializedData(preparedData)
//     client.publish(envelopes = prepared.envelopes)
//
// You can also stuff the `preparedData` elsewhere (e.g. in a database) if that
// is more convenient for your use case.
export type PreparedLocalMessage = {
  messageId: string
  preparedFileUri: `file://${string}`
  preparedAt: number // timestamp in milliseconds
}

// This contains the contents of a message.
// Each of these corresponds to a codec supported by the native libraries.
// This is a one-of or union type: only one of these fields will be present.

export class DecodedMessage {
  client: Client
  id: string
  topic: string
  contentTypeId: string
  senderAddress: string
  sent: number // timestamp in milliseconds
  _content: any
  fallback: string | undefined

  static from(json: string, client: Client): DecodedMessage {
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

  static fromObject(
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
  ): DecodedMessage {
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
    this._content = content
    this.fallback = fallback
  }

  content(): any {
    console.log('here is the content', this)
    console.log('registry', this.client.codecRegistry)

    const encodedJSON = this._content.encoded
    if (encodedJSON) {
      const encoded = JSON.parse(encodedJSON)
      const codec = this.client.codecRegistry[this.contentTypeId]

      if (!codec) {
        return this.fallback
      } else {
        return codec.decode(encoded)
      }
    } else {
      return this._content
    }
  }
}

export type ConversationContext = {
  conversationID: string
  metadata: { [key: string]: string }
}
