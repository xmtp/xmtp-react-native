import { ContentTypeID } from "../build/lib/ContentTypeID";

export type UnknownContent = {
  contentTypeId: string;
};

export type ReplyContent = {
  reference: string;
  content: MessageContent;
};

export type ReactionContent = {
  reference: string;
  action: "added" | "removed";
  schema: "unicode" | "shortcode" | "custom";
  content: string;
};

export type AttachmentContent = {
  filename: string;
  mimeType: string;
  data: string;
};

export type RemoteAttachmentContent = {
  filename: string;
  secret: string;
  salt: string;
  nonce: string;
  contentDigest: string;
  contentLength: string;
  scheme: string;
  url: string;
};

// This contains the contents of a message.
// Each of these corresponds to a codec supported by the native libraries.
// This is a one-of or union type: only one of these fields will be present.
export type MessageContent = {
  text?: string;
  unknown?: UnknownContent;
  reply?: ReplyContent;
  reaction?: ReactionContent;
  attachment?: AttachmentContent;
  remoteAttachment?: RemoteAttachmentContent;
};

export type DecodedMessage = {
  id: string;
  topic: string;
  content: MessageContent;
  senderAddress: string;
  sent: number; // timestamp in milliseconds
};
