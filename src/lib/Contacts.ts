import { Client } from "./Client";
import * as XMTPModule from "../index";

export default class Contacts {
  client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async isAllowed(address: string): Promise<boolean> {
    const result = await XMTPModule.isAllowed(this.client.address, address);
    return result;
  }

  async isBlocked(address: string): Promise<boolean> {
    const result = await XMTPModule.isBlocked(this.client.address, address);
    return result;
  }

  block(addresses: string[]) {
    XMTPModule.blockContacts(this.client.address, addresses);
  }

  allow(addresses: string[]) {
    XMTPModule.allowContacts(this.client.address, addresses);
  }

  refreshAllowList() {
    XMTPModule.refreshAllowList(this.client.address);
  }
}
