import { Client } from './Client'
import * as XMTPModule from '../index'

export class XMTPPush {
  client: Client<any>

  constructor(client: Client<any>) {
    this.client = client
  }
  static register(server: string, token: string) {
    XMTPModule.registerPushToken(server, token)
  }

  subscribe(topics: string[]) {
    XMTPModule.subscribePushTopics(this.client.address, topics)
  }
}
