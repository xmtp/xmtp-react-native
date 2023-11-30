import { Signer, utils } from "ethers";

import Conversations from "./Conversations";
import Contacts from "./Contacts";
import type {
  DecryptedLocalAttachment,
  DecodedMessage,
  EncryptedLocalAttachment,
  PreparedLocalMessage,
} from "../XMTP.types";
import { Query } from "./Query";
import { hexToBytes } from "./util";
import * as XMTPModule from "../index";

declare const Buffer;
export class Client {
  address: string;
  conversations: Conversations;
  contacts: Contacts;

  /**
   * Creates a new instance of the Client class using the provided signer.
   *
   * @param {Signer} signer - The signer object used for authentication and message signing.
   * @param {Partial<ClientOptions>} opts - Optional configuration options for the Client.
   * @returns {Promise<Client>} A Promise that resolves to a new Client instance.
   * 
   * See {@link https://xmtp.org/docs/build/authentication#create-a-client | XMTP Docs} for more information.
   */
  static async create(
    signer: Signer,
    opts?: Partial<ClientOptions>,
  ): Promise<Client> {
    const options = defaultOptions(opts);
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
          },
        );

        XMTPModule.emitter.addListener("authed", async () => {
          const address = await signer.getAddress();
          resolve(new Client(address));
        });
        XMTPModule.auth(
          await signer.getAddress(),
          options.env,
          options.appVersion,
        );
      })();
    });
  }

/**
 * Creates a new instance of the XMTP Client with a randomly generated address.
 *
 * @param {Partial<ClientOptions>} opts - Optional configuration options for the Client.
 * @returns {Promise<Client>} A Promise that resolves to a new Client instance with a random address.
 */
  static async createRandom(opts?: Partial<ClientOptions>): Promise<Client> {
    const options = defaultOptions(opts);
    const address = await XMTPModule.createRandom(
      options.env,
      options.appVersion,
    );
    return new Client(address);
  }

/**
 * Creates a new instance of the Client class from a provided key bundle.
 * 
 * This method is useful for scenarios where you want to manually handle private key storage,
 * allowing the application to have access to XMTP keys without exposing wallet keys.
 * 
 * @param {string} keyBundle - The key bundle used for address generation.
 * @param {Partial<ClientOptions>} opts - Optional configuration options for the Client.
 * @returns {Promise<Client>} A Promise that resolves to a new Client instance based on the provided key bundle.
 */
  static async createFromKeyBundle(
    keyBundle: string,
    opts?: Partial<ClientOptions>,
  ): Promise<Client> {
    const options = defaultOptions(opts);
    const address = await XMTPModule.createFromKeyBundle(
      keyBundle,
      options.env,
      options.appVersion,
    );
    return new Client(address);
  }

  /**
   * Determines whether the current user can send messages to a specified peer.
   *
   * This method checks if the specified peer has signed up for XMTP
   * and ensures that the message is not addressed to the sender (no self-messaging).
   *
   * @param {string} peerAddress - The address of the peer to check for messaging eligibility.
   * @returns {Promise<boolean>} A Promise resolving to true if messaging is allowed, and false otherwise.
   */

  async canMessage(peerAddress: string): Promise<boolean> {
    return await XMTPModule.canMessage(this.address, peerAddress);
  }

  /**
   * Static method to determine if the address is currently in our network.
   * 
   * This method checks if the specified peer has signed up for XMTP.
   * 
   * @param {string} peerAddress - The address of the peer to check for messaging eligibility.
   * @param {Partial<ClientOptions>} opts - Optional configuration options for the Client.
   * @returns {Promise<boolean>}
   */

  static async canMessage(peerAddress: string, opts?: Partial<ClientOptions>): Promise<boolean> {
    const options = defaultOptions(opts);
    return await XMTPModule.staticCanMessage(peerAddress, options.env, options.appVersion);
  }

  constructor(address: string) {
    this.address = address;
    this.conversations = new Conversations(this);
    this.contacts = new Contacts(this);
  }

  /**
   * Exports the key bundle associated with the current XMTP address.
   * 
   * This method allows you to obtain the unencrypted key bundle for the current XMTP address.
   * Ensure the exported keys are stored securely and encrypted.
   * 
   * @returns {Promise<string>} A Promise that resolves to the unencrypted key bundle for the current XMTP address.
   */
  async exportKeyBundle(): Promise<string> {
    return XMTPModule.exportKeyBundle(this.address);
  }

  // TODO: support persisting conversations for quick lookup
  // async importConversation(exported: string): Promise<Conversation> { ... }
  // async exportConversation(topic: string): Promise<string> { ... }

/**
 * Retrieves a list of batch messages based on the provided queries.
 *
 * This method pulls messages associated from multiple conversation with the current address
 * and specified queries.
 *
 * @param {Query[]} queries - An array of queries to filter the batch messages.
 * @returns {Promise<DecodedMessage[]>} A Promise that resolves to a list of batch messages.
 * @throws {Error} The error is logged, and the method gracefully returns an empty array.
 */
  async listBatchMessages(queries: Query[]): Promise<DecodedMessage[]> {
    try {
      return await XMTPModule.listBatchMessages(this.address, queries);
    } catch (e) {
      console.info("ERROR in listBatchMessages", e);
      return [];
    }
  }

  /**
   * Encrypts a local attachment for secure transmission.
   *
   * This asynchronous method takes a file, checks if it's a local file URI,
   * and encrypts the attachment for secure transmission.
   * @param {DecryptedLocalAttachment} file - The local attachment to be encrypted.
   * @returns {Promise<EncryptedLocalAttachment>} A Promise that resolves to the encrypted local attachment.
   * @throws {Error} Throws an error if the attachment is not a local file URI (must start with "file://").
   */
  async encryptAttachment(
    file: DecryptedLocalAttachment,
  ): Promise<EncryptedLocalAttachment> {
    if (!file.fileUri?.startsWith("file://")) {
      throw new Error("the attachment must be a local file:// uri");
    }
    return await XMTPModule.encryptAttachment(this.address, file);
  }

  /**
   * Decrypts an encrypted local attachment.
   * 
   * This asynchronous method takes an encrypted local attachment and decrypts it.
   * @param {EncryptedLocalAttachment} encryptedFile - The encrypted local attachment to be decrypted.
   * @returns {Promise<DecryptedLocalAttachment>} A Promise that resolves to the decrypted local attachment.
   * @throws {Error} Throws an error if the attachment is not a local file URI (must start with "file://").
   */
  async decryptAttachment(
    encryptedFile: EncryptedLocalAttachment,
  ): Promise<DecryptedLocalAttachment> {
    if (!encryptedFile.encryptedLocalFileUri?.startsWith("file://")) {
      throw new Error("the attachment must be a local file:// uri");
    }
    return await XMTPModule.decryptAttachment(this.address, encryptedFile);
  }

/**
 * Sends a prepared message.
 *
 * @param {PreparedLocalMessage} prepared - The prepared local message to be sent.
 * @returns {Promise<string>} A Promise that resolves to a string identifier for the sent message.
 * @throws {Error} Throws an error if there is an issue with sending the prepared message.
 */
  async sendPreparedMessage(prepared: PreparedLocalMessage): Promise<string> {
    try {
      return await XMTPModule.sendPreparedMessage(this.address, prepared);
    } catch (e) {
      console.info("ERROR in sendPreparedMessage()", e);
      throw e;
    }
  }
}

export type ClientOptions = NetworkOptions;
export type NetworkOptions = {
  /**
   * Specify which XMTP environment to connect to. (default: `dev`)
   */
  env: 'local' | 'dev' | 'production';
  /**
   * identifier that's included with API requests.
   *
   * For example, you can use the following format:
   * `appVersion: APP_NAME + '/' + APP_VERSION`.
   * Setting this value provides telemetry that shows which apps are
   * using the XMTP client SDK. This information can help XMTP developers
   * provide app support, especially around communicating important
   * SDK updates, including deprecations and required upgrades.
   */
  appVersion?: string;
};

/**
 * Provide a default client configuration. These settings can be used on their own, or as a starting point for custom configurations
 *
 * @param opts additional options to override the default settings
 */
export function defaultOptions(opts?: Partial<ClientOptions>): ClientOptions {
  const _defaultOptions: ClientOptions = {
    env: "dev",
  };

  return { ..._defaultOptions, ...opts } as ClientOptions;
}
