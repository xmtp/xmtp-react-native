import { Compression } from "./XMTP.enums";
import { ContentTypeID } from "./lib/ContentTypeID";

export type ChangeEventPayload = {
  value: string;
};

export type XMTPViewProps = {
  name: string;
};

/*
 * EncodedContent
 *
 * Represents encoded content and its metadata.
 *
 * @param {ContentTypeID | {}} type - The content type ID or object for this content.
 * @param {string} content - The encoded content data.
 * @param {Compression} compression - The compression algorithm used, if any.
 * @param {string} fallback - A fallback representation of the content, if any.
 */

export type EncodedContent = {
  type: ContentTypeID | {};
  content: string;
  compression?: Compression;
  fallback?: string;
};
