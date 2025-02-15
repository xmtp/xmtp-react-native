import { content } from '@xmtp/proto'

import { InboxId } from '../Client'

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

export type MultiRemoteAttachmentContent = {
  attachments: RemoteAttachmentInfo[]
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

export type MultiRemoteAttachmentMetadata = {
  filename?: string
  secret: string
  salt: string
  nonce: string
  contentDigest: string
  contentLength: string
}

export type RemoteAttachmentInfo = MultiRemoteAttachmentMetadata & {
  scheme: 'https://'
  url: string
}

export type RemoteAttachmentContent = RemoteAttachmentMetadata & {
  scheme: 'https://'
  url: string
}

export type GroupUpdatedMemberEntry = {
  inboxId: InboxId
}

export type GroupUpdatedMetadatEntry = {
  oldValue: string
  newValue: string
  fieldName: string
}

export type GroupUpdatedContent = {
  initiatedByInboxId: InboxId
  membersAdded: GroupUpdatedMemberEntry[]
  membersRemoved: GroupUpdatedMemberEntry[]
  metadataFieldsChanged: GroupUpdatedMetadatEntry[]
}

export type NativeMessageContent = {
  text?: string
  unknown?: UnknownContent
  reply?: ReplyContent
  reaction?: ReactionContent
  reactionV2?: ReactionContent
  attachment?: StaticAttachmentContent
  remoteAttachment?: RemoteAttachmentContent
  multiRemoteAttachment?: MultiRemoteAttachmentContent
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
