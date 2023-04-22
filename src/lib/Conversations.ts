import { Conversation } from "./Conversation";
import * as XMTPModule from "../index";
export default class Conversations {
  private known = {} as { [topic: string]: boolean };

  async list(): Promise<Conversation[]> {
    const result = await XMTPModule.listConversations();

    for (const conversation of result) {
      this.known[conversation.topic] = true;
    }

    return result;
  }

  // TODO: support conversation ID
  async newConversation(peerAddress: string): Promise<Conversation> {
    return await XMTPModule.createConversation(peerAddress, "");
  }

  async stream(callback: (conversation: Conversation) => Promise<void>) {
    XMTPModule.subscribeToConversations();
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
