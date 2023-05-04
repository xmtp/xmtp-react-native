import { NativeModulesProxy, EventEmitter } from "expo-modules-core";

import XMTPModule from "./XMTPModule";
import { Conversation } from "./lib/Conversation";
import type { DecodedMessage } from "./lib/DecodedMessage";

export function address(): string {
  return XMTPModule.address();
}

export async function auth(
  address: string,
  environment: "local" | "dev" | "production"
) {
  return await XMTPModule.auth(address, environment);
}

export async function receiveSignature(requestID: string, signature: string) {
  return await XMTPModule.receiveSignature(requestID, signature);
}

export async function createRandom(
  environment: "local" | "dev" | "production"
): Promise<string> {
  return await XMTPModule.createRandom(environment);
}

export async function listConversations(): Promise<Conversation[]> {
  return (await XMTPModule.listConversations()).map((json: string) => {
    return new Conversation(JSON.parse(json));
  });
}

export async function listMessages(
  conversationTopic: string,
  conversationID: string | undefined,
  limit?: number | undefined, 
  before?: Date | undefined, 
  after?: Date | undefined
): Promise<DecodedMessage[]> {
  return (
    await XMTPModule.loadMessages(
      conversationTopic,
      conversationID,
      limit,
      before?.getTime,
      after?.getTime
    )
  ).map((json: string) => {
      return JSON.parse(json);
    }
  );
}

// TODO: support conversation ID
export async function createConversation(
  peerAddress: string,
  conversationID: string | undefined
): Promise<Conversation> {
  return new Conversation(
    JSON.parse(await XMTPModule.createConversation(peerAddress, conversationID))
  );
}

export async function sendMessage(
  conversationTopic: string,
  conversationID: string | undefined,
  content: any
): Promise<DecodedMessage> {
  return JSON.parse(
    await XMTPModule.sendMessage(conversationTopic, conversationID, content)
  );
}

export function subscribeToConversations() {
  return XMTPModule.subscribeToConversations();
}

export async function subscribeToMessages(
  topic: string,
  conversationID?: string | undefined
) {
  return await XMTPModule.subscribeToMessages(topic, conversationID);
}

export async function unsubscribeFromMessages(
  topic: string,
  conversationID?: string | undefined
) {
  return await XMTPModule.unsubscribeFromMessages(topic, conversationID);
}

export function subscribePushToken(pushServer: string, token: string) {
  return XMTPModule.subscribePushToken(pushServer, token);
}

export const emitter = new EventEmitter(XMTPModule ?? NativeModulesProxy.XMTP);

export { Client } from "./lib/Client";
export { Conversation } from "./lib/Conversation";
export { DecodedMessage } from "./lib/DecodedMessage";
export { XMTPPush } from "./lib/XMTPPush";
