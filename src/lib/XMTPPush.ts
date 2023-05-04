import * as XMTPModule from "../index";

export class XMTPPush {
  static register(server: string, token: string) {
    XMTPModule.subscribePushToken(server, token);
  }
}
