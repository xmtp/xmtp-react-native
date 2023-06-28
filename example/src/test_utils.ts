import { ContentCodecInterface } from "xmtp-react-native-sdk/lib/CodecRegistry";

import { EncodedContent } from "../../src/XMTP.types";
import { CodecError } from "../../src/lib/CodecError";
import { ContentTypeID } from "../../src/lib/ContentTypeID";

export class NumberCodec implements ContentCodecInterface<number> {
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

  encode(content: number) {
    const encodedContent = {
      type: this.contentType,
      content: Buffer.from(JSON.stringify(content)),
      fallback: content.toString(),
      parameters: {},
    };

    return encodedContent;
  }

  decode(encodedContent: EncodedContent): number {
    try {
      const contentToDecode = new TextDecoder().decode(encodedContent.content);
      if (!Number(contentToDecode)) {
        throw new Error("Not a number");
      }
      return Number(contentToDecode);
    } catch (e) {
      throw new CodecError("invalidContent");
    }
  }
}

export class TextCodec implements ContentCodecInterface<string> {
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

  encode(content: string) {
    const encodedContent = {
      type: this.contentType,
      content: Buffer.from(JSON.stringify(content)),
      fallback: content,
      parameters: {},
    };

    return encodedContent;
  }

  decode(encodedContent: EncodedContent): string {
    try {
      const contentToDecode = new TextDecoder().decode(encodedContent.content);
      return JSON.parse(contentToDecode);
    } catch (e) {
      throw new CodecError("invalidContent");
    }
  }
}
