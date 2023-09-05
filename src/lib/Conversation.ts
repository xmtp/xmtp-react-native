import { PreparedMessage } from "./PreparedMessage";
import { MessageContent, DecodedMessage } from "../XMTP.types";
import * as XMTP from "../index";
import { ConversationContext } from "../index";

export class Conversation {
  clientAddress: string;
  createdAt: number;
  context?: ConversationContext;
  topic: string;
  peerAddress: string;
  version: string;
  conversationID?: string | undefined;

  constructor(params: {
    clientAddress: string;
    createdAt: number;
    context?: ConversationContext;
    topic: string;
    peerAddress: string;
    version: string;
    conversationID?: string | undefined;
  }) {
    this.clientAddress = params.clientAddress;
    this.createdAt = params.createdAt;
    this.context = params.context;
    this.topic = params.topic;
    this.peerAddress = params.peerAddress;
    this.version = params.version;
    this.conversationID = params.conversationID;
  }

  async exportTopicData(): Promise<string> {
    return await XMTP.exportConversationTopicData(
      this.clientAddress,
      this.topic,
    );
  }

  // TODO: Support pagination and conversation ID here
  async messages(
    limit?: number | undefined,
    before?: Date | undefined,
    after?: Date | undefined,
  ): Promise<DecodedMessage[]> {
    try {
      return await XMTP.listMessages(
        this.clientAddress,
        this.topic,
        limit,
        before,
        after,
      );
    } catch (e) {
      console.info("ERROR in listMessages", e);
      return [];
    }
  }

  // TODO: support conversation ID
  async send(content: string | MessageContent): Promise<string> {
    try {
      if (typeof content === "string") {
        content = { text: content };
      }
      return await XMTP.sendMessage(this.clientAddress, this.topic, content);
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
      );
    } catch (e) {
      console.info("ERROR in decodeMessage()", e);
      throw e;
    }
  }

  async prepareMessage(content: string | MessageContent): Promise<PreparedMessage> {}

  streamMessages(
    callback: (message: DecodedMessage) => Promise<void>,
  ): () => void {
    XMTP.subscribeToMessages(this.clientAddress, this.topic);
    const hasSeen = {};
    XMTP.emitter.addListener(
      "message",
      async ({
        clientAddress,
        message,
      }: {
        clientAddress: string;
        message: DecodedMessage;
      }) => {
        if (clientAddress !== this.clientAddress) {
          return;
        }
        if (hasSeen[message.id]) {
          return;
        }

        hasSeen[message.id] = true;
        await callback(message as DecodedMessage);
      },
    );

    return () => {
      XMTP.unsubscribeFromMessages(this.clientAddress, this.topic);
    };
  }
}
