import { ContentTypeID, EncodedContent } from "../../src/lib/Client";

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
    let encodedContent = new EncodedContent();
    encodedContent.type = this.contentType;
    encodedContent.version = this.contentType.versionMajor;
    encodedContent.content = JSON.stringify(content);
    return encodedContent;
  }

  decode(encodedContent: EncodedContent) {
    return JSON.parse(encodedContent.content);
  }
}
