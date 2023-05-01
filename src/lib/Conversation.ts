import { DecodedMessage } from "./DecodedMessage";
import * as XMTP from "../index";

export class Conversation {
  topic: string;
  peerAddress: string;
  version: string;
  conversationID?: string | undefined;

  constructor(params: {
    topic: string;
    peerAddress: string;
    version: string;
    conversationID?: string | undefined;
  }) {
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
      return await XMTP.listMessages(this.topic, this.conversationID, limit, before, after);
    } catch (e) {
      console.info("ERROR in listMessages", e);
      return [];
    }
  }

  // TODO: support content types and conversation ID
  async send(content: any): Promise<DecodedMessage> {
    try {
      return await XMTP.sendMessage(this.topic, this.conversationID, content);
    } catch (e) {
      console.info("ERROR in send()", e);
      throw e;
    }
  }

  streamMessages(
    callback: (message: DecodedMessage) => Promise<void>
  ): () => void {
    XMTP.subscribeToMessages(this.topic, this.conversationID);

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
      XMTP.unsubscribeFromMessages(this.topic, this.conversationID);
    };
  }
}
