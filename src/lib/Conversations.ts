import { Client } from "./Client";
import type { Conversation } from "./Conversation";
import * as XMTPModule from "../index";

export default class Conversations {
  client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async list(): Promise<Conversation[]> {
    return await XMTPModule.listConversations();
  }
}
