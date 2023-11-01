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

  async isDenied(address: string): Promise<boolean> {
    const result = await XMTPModule.isDenied(this.client.address, address);
    return result;
  }

  deny(addresses: string[]) {
    XMTPModule.denyContacts(this.client.address, addresses);
  }

  allow(addresses: string[]) {
    XMTPModule.allowContacts(this.client.address, addresses);
  }

  refreshConsentList() {
    XMTPModule.refreshConsentList(this.client.address);
  }
}
