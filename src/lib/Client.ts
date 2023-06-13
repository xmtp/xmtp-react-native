import { Signer, utils } from "ethers";
import Conversations from "./Conversations";
import { hexToBytes } from "./util";
import * as XMTPModule from "../index";
declare const Buffer;
export class Client {
  address: string;
  conversations: Conversations;

  static async create(
    signer: Signer,
    environment: "local" | "dev" | "production"
  ): Promise<Client> {
    return new Promise<Client>((resolve, reject) => {
      (async () => {
        XMTPModule.emitter.addListener(
          "sign",
          async (message: { id: string; message: string }) => {
            const request: { id: string; message: string } = message;
            const signatureString = await signer.signMessage(request.message);
            const eSig = utils.splitSignature(signatureString);
            const r = hexToBytes(eSig.r);
            const s = hexToBytes(eSig.s);
            const sigBytes = new Uint8Array(65);
            sigBytes.set(r);
            sigBytes.set(s, r.length);
            sigBytes[64] = eSig.recoveryParam;

            const signature = Buffer.from(sigBytes).toString("base64");

            XMTPModule.receiveSignature(request.id, signature);
          }
        );

        XMTPModule.emitter.addListener("authed", async () => {
          const address = await signer.getAddress();
          resolve(new Client(address));
        });
        XMTPModule.auth(await signer.getAddress(), environment);
      })();
    });
  }

  static async createRandom(
    environment: "local" | "dev" | "production"
  ): Promise<Client> {
    const address = await XMTPModule.createRandom(environment);
    return new Client(address);
  }

  async canMessage(peerAddress: string): Promise<boolean> {
    return await XMTPModule.canMessage(this.address, peerAddress);
  }

  constructor(address: string) {
    this.address = address;
    this.conversations = new Conversations(this);
  }

  async listBatchMessages(
    topics: string[],
    conversationIDs: (string | undefined)[],
    limit?: number | undefined,
    before?: Date | undefined,
    after?: Date | undefined
  ): Promise<XMTPModule.DecodedMessage[]> {
    try {
      return await XMTPModule.listBatchMessages(
        this.address,
        topics,
        conversationIDs,
        limit,
        before,
        after
      );
    } catch (e) {
      console.info("ERROR in listBatchMessages", e);
      return [];
    }
  }
}

/*
 *
 * This ContentTypeID class represents a content type identifier.
 *
 * @param {string} authorityID - The authority that defined the content type.
 * @param {string} typeID - The unique ID for the content type within the authority, e.g. "number"
 * @param {number} versionMajor -  The major version number of the content type.
 * @param {number} versionMinor - The minor version number of the content type.
 *
 * @returns {string} The full content type ID in the format:
 * <authorityID>:<typeID>
 */

export class ContentTypeID {
  authorityID: string;
  typeID: string;
  versionMajor: number;
  versionMinor: number;
  constructor({ authorityID, typeID, versionMajor, versionMinor }) {
    this.authorityID = authorityID;
    this.typeID = typeID;
    this.versionMajor = versionMajor;
    this.versionMinor = versionMinor;
  }

  id() {
    return `${this.authorityID}:${this.typeID}`;
  }
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
   * @returns {ContentCodecInterface | undefined} The found codec, or undefined if not found.
   */
  find(contentTypeID: string) {
    return this.codecs[contentTypeID];
  }
}

/*
 *
 * An error class for codec-related errors during decoding.
 *
 * @param {string} message - The error message.
 */

export class CodecError extends Error {
  constructor(message: "invalidContent" | "codecNotFound") {
    super(message);
    this.name = message;
  }
}

/*
 *
 * Represents encoded content along with metadata.
 *
 * @param {ContentTypeID | {}} type - The contentTypeID or object for this content.
 * @param {number} version - The version of the encoding format.
 * @param {string} content - The encoded content data.
 *
 * @returns {T} The decoded content (else an error will be thrown)
 */

export class EncodedContent {
  type: ContentTypeID | {};
  version: number;
  content: string;

  decoded<T>(registry: CodecRegistry) {
    const id = (this.type as ContentTypeID).id();
    const codec = registry.find(id);
    if (!codec) throw new CodecError("codecNotFound");
    if (codec.decode(this)) return codec.decode(this);
    throw new CodecError("invalidContent");
  }
}

/*
 *
 * Codecs encode and decode content, and this is the interface for ContentCodecs within this app.
 *
 * @param {ContentTypeID} contentType - The content type this codec handles.
 * @param {<T>} encode(content) - Encodes the given content and returns an EncodedContent.
 * @param {<T>} decode(content) - Decodes the given EncodedContent and returns the original content.
 */

interface ContentCodecInterface {
  contentType: ContentTypeID;
  encode<T>(content: T): EncodedContent;
  decode<T>(content: EncodedContent): T;
}
