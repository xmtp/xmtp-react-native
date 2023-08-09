import { decode } from "@msgpack/msgpack";
import * as proto from "@xmtp/proto";
import { EncodedContent } from "@xmtp/proto/ts/dist/types/message_contents/content.pb";
import { NativeModulesProxy, EventEmitter } from "expo-modules-core";

import XMTPModule from "./XMTPModule";
import { Conversation } from "./lib/Conversation";
import type { Query } from "./lib/Query";
import type { MessageContent, DecodedMessage } from "./XMTP.types";

export function address(): string {
  return XMTPModule.address();
}

export async function auth(
  address: string,
  environment: "local" | "dev" | "production",
  appVersion?: string | undefined,
) {
  return await XMTPModule.auth(address, environment, appVersion);
}

export async function receiveSignature(requestID: string, signature: string) {
  return await XMTPModule.receiveSignature(requestID, signature);
}

export async function createRandom(
  environment: "local" | "dev" | "production",
  appVersion?: string | undefined,
): Promise<string> {
  return await XMTPModule.createRandom(environment, appVersion);
}

export async function createFromKeyBundle(
  keyBundle: string,
  environment: "local" | "dev" | "production",
  appVersion?: string | undefined,
): Promise<string> {
  return await XMTPModule.createFromKeyBundle(
    keyBundle,
    environment,
    appVersion,
  );
}

export async function exportKeyBundle(clientAddress: string): Promise<string> {
  return await XMTPModule.exportKeyBundle(clientAddress);
}

export async function exportConversationTopicData(
  clientAddress: string,
  conversationTopic: string,
): Promise<string> {
  return await XMTPModule.exportConversationTopicData(
    clientAddress,
    conversationTopic,
  );
}

export async function importConversationTopicData(
  clientAddress: string,
  topicData: string,
): Promise<Conversation> {
  const json = await XMTPModule.importConversationTopicData(
    clientAddress,
    topicData,
  );
  return new Conversation(JSON.parse(json));
}

export async function canMessage(
  clientAddress: string,
  peerAddress: string,
): Promise<boolean> {
  return await XMTPModule.canMessage(clientAddress, peerAddress);
}

export async function listConversations(
  clientAddress: string,
): Promise<Conversation[]> {
  return (await XMTPModule.listConversations(clientAddress)).map(
    (json: string) => {
      return new Conversation(JSON.parse(json));
    },
  );
}

export async function listMessages(
  clientAddress: string,
  conversationTopic: string,
  conversationID: string | undefined,
  limit?: number | undefined,
  before?: Date | undefined,
  after?: Date | undefined,
): Promise<DecodedMessage[]> {
  const messages = await XMTPModule.loadMessages(
    clientAddress,
    conversationTopic,
    limit,
    before?.getTime(),
    after?.getTime(),
  );
  return messages.map((json: string) => {
    return JSON.parse(json);
  });
}

export async function listBatchMessages(
  clientAddress: string,
  queries: Query[],
): Promise<DecodedMessage[]> {
  const topics = queries.map((item) => {
    return JSON.stringify({
      limit: item.pageSize || 0,
      topic: item.contentTopic,
      after: item.startTime?.getTime() || 0,
      before: item.endTime?.getTime() || 0,
    });
  });
  const messages = await XMTPModule.loadBatchMessages(clientAddress, topics);

  return messages.map((json: string) => {
    return JSON.parse(json);
  });
}

// TODO: support conversation ID
export async function createConversation(
  clientAddress: string,
  peerAddress: string,
  conversationID: string | undefined,
): Promise<Conversation> {
  return new Conversation(
    JSON.parse(
      await XMTPModule.createConversation(
        clientAddress,
        peerAddress,
        conversationID,
      ),
    ),
  );
}

export async function sendMessage(
  clientAddress: string,
  conversationTopic: string,
  conversationID: string | undefined,
  content: MessageContent,
): Promise<string> {
  // TODO: consider eager validating of `MessageContent` here
  //       instead of waiting for native code to validate
  let contentJson = JSON.stringify(content);
  return await XMTPModule.sendMessage(
    clientAddress,
    conversationTopic,
    conversationID,
    contentJson,
  );
}

export function subscribeToConversations(clientAddress: string) {
  return XMTPModule.subscribeToConversations(clientAddress);
}

export function subscribeToAllMessages(clientAddress: string) {
  return XMTPModule.subscribeToAllMessages(clientAddress);
}

export async function subscribeToMessages(
  clientAddress: string,
  topic: string,
  conversationID?: string | undefined,
) {
  return await XMTPModule.subscribeToMessages(
    clientAddress,
    topic,
    conversationID,
  );
}

export async function unsubscribeFromMessages(
  clientAddress: string,
  topic: string,
  conversationID?: string | undefined,
) {
  return await XMTPModule.unsubscribeFromMessages(
    clientAddress,
    topic,
    conversationID,
  );
}

export function registerPushToken(pushServer: string, token: string) {
  return XMTPModule.registerPushToken(pushServer, token);
}

export function subscribePushTopics(topics: string[]) {
  return XMTPModule.subscribePushTopics(topics);
}

export async function decodeMessage(
  clientAddress: string,
  topic: string,
  encryptedMessage: string,
  conversationID?: string | undefined,
): Promise<DecodedMessage> {
  return JSON.parse(
    await XMTPModule.decodeMessage(
      clientAddress,
      topic,
      encryptedMessage,
      conversationID,
    ),
  );
}

export const emitter = new EventEmitter(XMTPModule ?? NativeModulesProxy.XMTP);

export { Client } from "./lib/Client";
export { Conversation } from "./lib/Conversation";
export * from "./XMTP.types";
export { Query } from "./lib/Query";
export { XMTPPush } from "./lib/XMTPPush";
