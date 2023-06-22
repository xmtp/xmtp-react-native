import { EncodedContent } from "../../src/XMTP.types";
import { CodecError } from "../../src/lib/CodecError";
import { ContentTypeID } from "../../src/lib/ContentTypeID";

export class NumberCodec {
  contentType: {
    id(): string;
    authorityId: string;
    typeId: string;
    versionMajor: number;
    versionMinor: number;
  };

  constructor() {
    this.contentType = new ContentTypeID({
      authorityId: "example.com",
      typeId: "number",
      versionMajor: 1,
      versionMinor: 1,
    });
  }

  encode(content: Uint8Array) {
    const encodedContent = {
      type: this.contentType,
      content: Buffer.from(JSON.stringify(content)),
      fallback: "fallbackText",
    };

    return encodedContent;
  }

  decode(encodedContent: EncodedContent) {
    try {
      const contentToDecode = encodedContent.content.toString();
      const decodedContent = JSON.parse(contentToDecode);
      return decodedContent;
    } catch {
      throw new CodecError("invalidContent");
    }
  }
}
