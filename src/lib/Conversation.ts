import { DecodedMessage } from "./DecodedMessage";
import * as XMTP from "../index";

export class Conversation {
  clientAddress: string;
  topic: string;
  peerAddress: string;
  version: string;
  conversationID?: string | undefined;

  constructor(params: {
    clientAddress: string;
    topic: string;
    peerAddress: string;
    version: string;
    conversationID?: string | undefined;
  }) {
    this.clientAddress = params.clientAddress;
    this.topic = params.topic;
    this.peerAddress = params.peerAddress;
    this.version = params.version;
    this.conversationID = params.conversationID;
  }

  // TODO: Support pagination and conversation ID here
  async messages(
    limit?: number | undefined,
    before?: Date | undefined,
    after?: Date | undefined
  ): Promise<DecodedMessage[]> {
    try {
      return await XMTP.listMessages(
        this.clientAddress,
        this.topic,
        this.conversationID,
        limit,
        before,
        after
      );
    } catch (e) {
      console.info("ERROR in listMessages", e);
      return [];
    }
  }

  // TODO: support content types and conversation ID
  async send(content: any): Promise<string> {
    try {
      return await XMTP.sendMessage(
        this.clientAddress,
        this.topic,
        this.conversationID,
        content
      );
    } catch (e) {
      console.info("ERROR in send()", e);
      throw e;
    }
  }

  async decodeMessage(encryptedMessage: string): Promise<DecodedMessage> {
    try {
      return await XMTP.decodeMessage(
        this.clientAddress,
        this.topic,
        encryptedMessage,
        this.conversationID
      );
    } catch (e) {
      console.info("ERROR in decodeMessage()", e);
      throw e;
    }
  }

  streamMessages(
    callback: (message: DecodedMessage) => Promise<void>
  ): () => void {
    XMTP.subscribeToMessages(
      this.clientAddress,
      this.topic,
      this.conversationID
    );

    XMTP.emitter.addListener(
      "message",
      async (message: {
        topic: string;
        conversationID: string | undefined;
        messageJSON: string;
      }) => {
        if (
          message.topic === this.topic &&
          message.conversationID === this.conversationID
        ) {
          await callback(JSON.parse(message.messageJSON));
        }
      }
    );

    return () => {
      XMTP.unsubscribeFromMessages(
        this.clientAddress,
        this.topic,
        this.conversationID
      );
    };
  }
}
