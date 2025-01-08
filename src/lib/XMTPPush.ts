import { Client } from './Client'
import * as XMTPModule from '../index'
import { ConversationTopic } from '../index'

export class XMTPPush {
  client: Client<any>

  constructor(client: Client<any>) {
    this.client = client
  }
  static register(server: string, token: string) {
    XMTPModule.registerPushToken(server, token)
  }

  subscribe(topics: ConversationTopic[]) {
    XMTPModule.subscribePushTopics(this.client.installationId, topics)
  }
}
