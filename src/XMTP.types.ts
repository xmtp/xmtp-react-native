import { ContentTypeID } from "./lib/ContentTypeID";

export type ChangeEventPayload = {
  value: string;
};

export type XMTPViewProps = {
  name: string;
};

/*
 *
 * Represents encoded content and its metadata.
 *
 * @param {ContentTypeID} type - The content type ID for this content.
 * @param {Uint8Array} content - The encoded content data.
 * @param {string} fallback - A fallback representation of the content, if any.
 */

export type EncodedContent = {
  type: ContentTypeID;
  parameters: { [key: string]: string } | undefined;
  content: Uint8Array;
  fallback?: string;
};
