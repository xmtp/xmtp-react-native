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

export async function listConversations(
  clientAddress: string
): Promise<Conversation[]> {
  return (await XMTPModule.listConversations(clientAddress)).map(
    (json: string) => {
      return new Conversation(JSON.parse(json));
    }
  );
}

export async function listMessages(
  clientAddress: string,
  conversationTopic: string,
  conversationID: string | undefined,
  limit?: number | undefined,
  before?: Date | undefined,
  after?: Date | undefined
): Promise<DecodedMessage[]> {
  return (
    await XMTPModule.loadMessages(
      clientAddress,
      conversationTopic,
      conversationID,
      limit,
      before?.getTime,
      after?.getTime
    )
  ).map((json: string) => {
    return JSON.parse(json);
  });
}

// TODO: support conversation ID
export async function createConversation(
  clientAddress: string,
  peerAddress: string,
  conversationID: string | undefined
): Promise<Conversation> {
  return new Conversation(
    JSON.parse(
      await XMTPModule.createConversation(
        clientAddress,
        peerAddress,
        conversationID
      )
    )
  );
}

export async function sendMessage(
  clientAddress: string,
  conversationTopic: string,
  conversationID: string | undefined,
  content: any
): Promise<DecodedMessage> {
  return JSON.parse(
    await XMTPModule.sendMessage(
      clientAddress,
      conversationTopic,
      conversationID,
      content
    )
  );
}

export function subscribeToConversations(clientAddress: string) {
  return XMTPModule.subscribeToConversations(clientAddress);
}

export async function subscribeToMessages(
  clientAddress: string,
  topic: string,
  conversationID?: string | undefined
) {
  return await XMTPModule.subscribeToMessages(
    clientAddress,
    topic,
    conversationID
  );
}

export async function unsubscribeFromMessages(
  clientAddress: string,
  topic: string,
  conversationID?: string | undefined
) {
  return await XMTPModule.unsubscribeFromMessages(
    clientAddress,
    topic,
    conversationID
  );
}

export function registerPushToken(pushServer: string, token: string) {
  return XMTPModule.registerPushToken(pushServer, token);
}

export function subscribePushTopics(topics: string[]) {
  return XMTPModule.subscribePushTopics(topics);
}

export async function decodeMessage(
  topic: string,
  encryptedMessage: string,
  conversationID?: string | undefined
): Promise<DecodedMessage> {
  return JSON.parse(
    await XMTPModule.decodeMessage(topic, encryptedMessage, conversationID)
  );
}

export const emitter = new EventEmitter(XMTPModule ?? NativeModulesProxy.XMTP);

export { Client } from "./lib/Client";
export { Conversation } from "./lib/Conversation";
export { DecodedMessage } from "./lib/DecodedMessage";
export { XMTPPush } from "./lib/XMTPPush";
