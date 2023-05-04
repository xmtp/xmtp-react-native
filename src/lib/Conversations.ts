import { Conversation } from "./Conversation";
import { Client } from "./Client";
import * as XMTPModule from "../index";

type Context = {
  conversationID: string;
  metadata: { [key: string]: string };
};
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

  // TODO: support conversation ID
  async newConversation(
    peerAddress: string,
    context?: Context
  ): Promise<Conversation> {
    return await XMTPModule.createConversation(
      this.client.address,
      peerAddress,
      context?.conversationID
    );
  }

  async stream(callback: (conversation: Conversation) => Promise<void>) {
    XMTPModule.subscribeToConversations(this.client.address);
    XMTPModule.emitter.addListener(
      "conversation",
      async (conversation: Conversation) => {
        if (this.known[conversation.topic]) {
          return;
        }

        this.known[conversation.topic] = true;
        await callback(new Conversation(conversation));
      }
    );
  }
}
