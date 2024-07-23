import { content } from '@xmtp/proto'

export type EncodedContent = content.EncodedContent
export type ContentTypeId = content.ContentTypeId

export type UnknownContent = {
  contentTypeId: string
}

export type ReadReceiptContent = object

export type ReplyContent = {
  reference: string
  content: NativeMessageContent
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

export type GroupUpdatedMemberEntry = {
  inboxId: string
}

export type GroupUpdatedMetadatEntry = {
  oldValue: string
  newValue: string
  fieldName: string
}

export type GroupUpdatedContent = {
  initiatedByInboxId: string
  membersAdded: GroupUpdatedMemberEntry[]
  membersRemoved: GroupUpdatedMemberEntry[]
  metadataFieldsChanged: GroupUpdatedMetadatEntry[]
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

export type NativeMessageContent = {
  text?: string
  unknown?: UnknownContent
  reply?: ReplyContent
  reaction?: ReactionContent
  attachment?: StaticAttachmentContent
  remoteAttachment?: RemoteAttachmentContent
  readReceipt?: ReadReceiptContent
  encoded?: string
  groupUpdated?: GroupUpdatedContent
}

export interface JSContentCodec<T> {
  contentType: ContentTypeId
  encode(content: T): EncodedContent
  decode(encodedContent: EncodedContent): T
  fallback(content: T): string | undefined
}

export interface NativeContentCodec<T> {
  contentKey: string
  contentType: ContentTypeId
  encode(content: T): NativeMessageContent
  decode(nativeContent: NativeMessageContent): T
  fallback(content: T): string | undefined
}

export type ContentCodec<T> = JSContentCodec<T> | NativeContentCodec<T>
