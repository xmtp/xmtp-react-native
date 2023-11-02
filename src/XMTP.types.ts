export type UnknownContent = {
  contentTypeId: string;
};

export type ReadReceiptContent = object;

export type ReplyContent = {
  reference: string;
  content: MessageContent;
};

export type ReactionContent = {
  reference: string;
  action: "added" | "removed" | "unknown";
  schema: "unicode" | "shortcode" | "custom" | "unknown";
  content: string;
};

export type StaticAttachmentContent = {
  filename: string;
  mimeType: string;
  data: string;
};

export type DecryptedLocalAttachment = {
  fileUri: string;
  mimeType?: string;
  filename?: string;
};

export type RemoteAttachmentMetadata = {
  filename?: string;
  secret: string;
  salt: string;
  nonce: string;
  contentDigest: string;
  contentLength?: string;
};

export type EncryptedLocalAttachment = {
  encryptedLocalFileUri: `file://${string}`;
  metadata: RemoteAttachmentMetadata;
};

export type RemoteAttachmentContent = RemoteAttachmentMetadata & {
  scheme: "https://";
  url: string;
};

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
  messageId: string;
  preparedFileUri: `file://${string}`;
  preparedAt: number; // timestamp in milliseconds
}

// This contains the contents of a message.
// Each of these corresponds to a codec supported by the native libraries.
// This is a one-of or union type: only one of these fields will be present.
export type MessageContent = {
  text?: string;
  unknown?: UnknownContent;
  reply?: ReplyContent;
  reaction?: ReactionContent;
  attachment?: StaticAttachmentContent;
  remoteAttachment?: RemoteAttachmentContent;
  readReceipt?: ReadReceiptContent;
};

export type DecodedMessage = {
  id: string;
  topic: string;
  contentTypeId: string;
  content: MessageContent;
  senderAddress: string;
  sent: number; // timestamp in milliseconds
  fallback: string | undefined;
};

export type ConversationContext = {
  conversationID: string;
  metadata: { [key: string]: string };
};
