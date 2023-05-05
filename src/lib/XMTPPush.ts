import * as XMTPModule from "../index";

export class XMTPPush {
  static register(server: string, token: string) {
    XMTPModule.registerPushToken(server, token);
  }

  static subscribe(topics: string[]) {
    XMTPModule.subscribePushTopics(topics);
  }
}
