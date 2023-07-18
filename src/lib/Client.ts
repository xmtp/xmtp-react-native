import { Signer, utils } from "ethers";

import Conversations from "./Conversations";
import { Query } from "./Query";
import { hexToBytes } from "./util";
import * as XMTPModule from "../index";
import { DecodedMessage } from "./DecodedMessage";

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

  static async createFromKeyBundle(
    keyBundle: string,
    environment: "local" | "dev" | "production"
  ): Promise<Client> {
    const address = await XMTPModule.createFromKeyBundle(
      keyBundle,
      environment
    );
    return new Client(address);
  }

  async canMessage(peerAddress: string): Promise<boolean> {
    return await XMTPModule.canMessage(this.address, peerAddress);
  }

  constructor(address: string) {
    this.address = address;
    this.conversations = new Conversations(this);
  }

  async exportKeyBundle(): Promise<string> {
    return XMTPModule.exportKeyBundle(this.address);
  }

  // TODO: support persisting conversations for quick lookup
  // async importConversation(exported: string): Promise<Conversation> { ... }
  // async exportConversation(topic: string): Promise<string> { ... }

  async listBatchMessages(queries: Query[]): Promise<DecodedMessage[]> {
    try {
      return await XMTPModule.listBatchMessages(this.address, queries);
    } catch (e) {
      console.info("ERROR in listBatchMessages", e);
      return [];
    }
  }
}
