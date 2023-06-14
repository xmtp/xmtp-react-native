import { EncodedContent } from "../../src/XMTP.types";
import { CodecError } from "../../src/lib/CodecError";
import { ContentTypeID } from "../../src/lib/ContentTypeID";
import { Compression } from "../../src/XMTP.enums";

export class NumberCodec {
  contentType: {
    id(): string;
    authorityID: string;
    typeID: string;
    versionMajor: number;
    versionMinor: number;
  };

  constructor() {
    this.contentType = new ContentTypeID({
      authorityID: "example.com",
      typeID: "number",
      versionMajor: 1,
      versionMinor: 1,
    });
  }

  encode<T>(content: T) {
    const encodedContent = {
      type: this.contentType,
      content: JSON.stringify(content),
      compression: Compression.COMPRESSION_DEFLATE,
      fallback: "fallbackText",
    };

    return encodedContent;
  }

  decode(encodedContent: EncodedContent) {
    try {
      const decodedContent = JSON.parse(encodedContent.content);
      return decodedContent;
    } catch {
      throw new CodecError("invalidContent");
    }
  }
}
