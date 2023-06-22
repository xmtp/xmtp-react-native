import { EncodedContent } from "../XMTP.types";
import { CodecError } from "./CodecError";
import { ContentTypeID } from "./ContentTypeID";

/*
 *
 * Codecs encode and decode content, and this is the interface for ContentCodecs within this app.
 *
 * @param {ContentTypeID} contentType - The content type this codec handles.
 * @param {<T>} encode(content) - Encodes the given content and returns an EncodedContent.
 * @param {<T>} decode(content) - Decodes the given EncodedContent and returns the original content.
 */

export interface ContentCodecInterface<T> {
  contentType: ContentTypeID;
  encode(content: T): EncodedContent;
  decode(content: EncodedContent): T;
}

/*
 * CodecRegistry
 *
 * A registry for content codecs. Allows registering codecs by id
 * and looking them up.
 *
 */
export class CodecRegistry {
  codecs: { [key: string]: ContentCodecInterface };

  constructor() {
    /*
     * An object mapping content type IDs to
     * codec instances.
     */
    this.codecs = {};
  }

  /*
   * Registers a content codec.
   *
   * @param {ContentCodecInterface} codec - This is the codec instance to register.
   */
  register(codec: ContentCodecInterface) {
    const contentType = codec.contentType.id();
    this.codecs[contentType] = codec;
  }

  /*
   * Finds a registered codec by content type ID.
   *
   * @param {string} contentTypeID - The id to look up.
   * @returns {ContentCodecInterface} The found codec, or an error is thrown if not found.
   */
  find(contentTypeID: string) {
    const codec = this.codecs[contentTypeID];
    if (!codec) {
      throw new CodecError("codecNotFound");
    } else {
      return codec;
    }
  }
}
