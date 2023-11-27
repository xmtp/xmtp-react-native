import { content } from "@xmtp/proto";
import * as XMTP from "../index";
import XMTPModule from "../XMTPModule";

export type EncodedContent = content.EncodedContent;
export type ContentTypeId = content.ContentTypeId;

// Native Content Codecs have two generic types:

export interface JSContentCodec<T> {
  contentType: ContentTypeId;
  encode(content: T): EncodedContent;
  decode(encodedContent: EncodedContent): T;
  fallback(content: T): string | undefined;
}

export const ContentTypeText: ContentTypeId = {
  authorityId: "xmtp.org",
  typeId: "text",
  versionMajor: 1,
  versionMinor: 0,
};

export type ContentCodec = JSContentCodec<any>;
