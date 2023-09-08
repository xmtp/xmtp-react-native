import { Client } from "./Client";
import { Conversation } from "./Conversation";
import type { ConversationContext, DecodedMessage } from "../XMTP.types";
import * as XMTPModule from "../index";

export default class Conversations {
  client: Client;
  private known = {} as { [topic: string]: boolean };

  constructor(client: Client) {
    this.client = client;
  }

  async list(): Promise<Conversation[]> {
    const result = await XMTPModule.listConversations(this.client.address);

    for (const conversation of result) {
      this.known[conversation.topic] = true;
    }

    return result;
  }

  async importTopicData(topicData: string): Promise<Conversation> {
    const conversation = await XMTPModule.importConversationTopicData(
      this.client.address,
      topicData,
    );
    this.known[conversation.topic] = true;
    return conversation;
  }

  async newConversation(
    peerAddress: string,
    context?: ConversationContext,
  ): Promise<Conversation> {
    return await XMTPModule.createConversation(
      this.client.address,
      peerAddress,
      context,
    );
  }

  async stream(callback: (conversation: Conversation) => Promise<void>) {
    XMTPModule.subscribeToConversations(this.client.address);
    XMTPModule.emitter.addListener(
      "conversation",
      async ({
        clientAddress,
        conversation,
      }: {
        clientAddress: string;
        conversation: Conversation;
      }) => {
        if (clientAddress !== this.client.address) {
          return;
        }
        if (this.known[conversation.topic]) {
          return;
        }

        this.known[conversation.topic] = true;
        await callback(new Conversation(conversation));
      },
    );
  }

  async streamAllMessages(
    callback: (message: DecodedMessage) => Promise<void>,
  ) {
    XMTPModule.subscribeToAllMessages(this.client.address);
    XMTPModule.emitter.addListener(
      "message",
      async ({
        clientAddress,
        message,
      }: {
        clientAddress: string;
        message: DecodedMessage;
      }) => {
        if (clientAddress !== this.client.address) {
          return;
        }
        if (this.known[message.id]) {
          return;
        }

        this.known[message.id] = true;
        await callback(message as DecodedMessage);
      },
    );
  }

  cancelStream() {
    XMTPModule.unsubscribeFromConversations();
  }

  cancelStreamAllMessages() {
    XMTPModule.unsubscribeFromAllMessages();
  }
}
