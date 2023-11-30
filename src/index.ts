import { EventEmitter, NativeModulesProxy } from "expo-modules-core";

import XMTPModule from "./XMTPModule";
import { Conversation } from "./lib/Conversation";
import type { Query } from "./lib/Query";
import type {
  ConversationContext,
  DecodedMessage,
  DecryptedLocalAttachment,
  EncryptedLocalAttachment,
  MessageContent,
  PreparedLocalMessage,
} from "./XMTP.types";

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

export async function publicCanMessage(
  peerAddress: string,
  environment: "local" | "dev" | "production",
  appVersion?: string | undefined,
): Promise<boolean> {
  return await XMTPModule.publicCanMessage(peerAddress, environment, appVersion);
}

export async function encryptAttachment(
  clientAddress: string,
  file: DecryptedLocalAttachment,
): Promise<EncryptedLocalAttachment> {
  let fileJson = JSON.stringify(file);
  let encryptedFileJson = await XMTPModule.encryptAttachment(
    clientAddress,
    fileJson,
  );
  return JSON.parse(encryptedFileJson);
}

export async function decryptAttachment(
  clientAddress: string,
  encryptedFile: EncryptedLocalAttachment,
): Promise<DecryptedLocalAttachment> {
  let encryptedFileJson = JSON.stringify(encryptedFile);
  let fileJson = await XMTPModule.decryptAttachment(
    clientAddress,
    encryptedFileJson,
  );
  return JSON.parse(fileJson);
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
  limit?: number | undefined,
  before?: number | Date | undefined,
  after?: number | Date | undefined,
  direction?: "SORT_DIRECTION_ASCENDING" | "SORT_DIRECTION_DESCENDING" | undefined,
): Promise<DecodedMessage[]> {
  const messages = await XMTPModule.loadMessages(
    clientAddress,
    conversationTopic,
    limit,
    typeof before === 'number' ? before : before?.getTime(),
    typeof after === 'number' ? after : after?.getTime(),
    direction || "SORT_DIRECTION_DESCENDING",
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
      after: (typeof item.startTime === 'number' ? item.startTime :  item.startTime?.getTime()) || 0,
      before: (typeof item.endTime === 'number' ? item.endTime :  item.endTime?.getTime()) || 0,
      direction: item.direction || "SORT_DIRECTION_DESCENDING",
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
  context?: ConversationContext,
): Promise<Conversation> {
  return new Conversation(
    JSON.parse(
      await XMTPModule.createConversation(
        clientAddress,
        peerAddress,
        JSON.stringify(context || {}),
      ),
    ),
  );
}

export async function sendMessage(
  clientAddress: string,
  conversationTopic: string,
  content: MessageContent,
): Promise<string> {
  // TODO: consider eager validating of `MessageContent` here
  //       instead of waiting for native code to validate
  let contentJson = JSON.stringify(content);
  return await XMTPModule.sendMessage(
    clientAddress,
    conversationTopic,
    contentJson,
  );
}

export async function prepareMessage(
  clientAddress: string,
  conversationTopic: string,
  content: MessageContent,
): Promise<PreparedLocalMessage> {
  // TODO: consider eager validating of `MessageContent` here
  //       instead of waiting for native code to validate
  let contentJson = JSON.stringify(content);
  let preparedJson = await XMTPModule.prepareMessage(
    clientAddress,
    conversationTopic,
    contentJson,
  );
  return JSON.parse(preparedJson);
}

export async function sendPreparedMessage(
  clientAddress: string,
  preparedLocalMessage: PreparedLocalMessage,
): Promise<string> {
  let preparedLocalMessageJson = JSON.stringify(preparedLocalMessage);
  return await XMTPModule.sendPreparedMessage(
    clientAddress,
    preparedLocalMessageJson,
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
) {
  return await XMTPModule.subscribeToMessages(clientAddress, topic);
}

export function unsubscribeFromConversations(clientAddress: string) {
  return XMTPModule.unsubscribeFromConversations(clientAddress);
}

export function unsubscribeFromAllMessages(clientAddress: string) {
  return XMTPModule.unsubscribeFromAllMessages(clientAddress);
}

export async function unsubscribeFromMessages(
  clientAddress: string,
  topic: string,
) {
  return await XMTPModule.unsubscribeFromMessages(clientAddress, topic);
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
): Promise<DecodedMessage> {
  return JSON.parse(
    await XMTPModule.decodeMessage(clientAddress, topic, encryptedMessage),
  );
}

export async function conversationConsentState(
  clientAddress: string, 
  conversationTopic: string
): Promise<"allowed" | "denied" | "unknown"> {
  return await XMTPModule.conversationConsentState(clientAddress, conversationTopic);
}

export async function isAllowed(
  clientAddress: string,
  address: string,
): Promise<boolean> {
  return await XMTPModule.isAllowed(clientAddress, address);
}

export async function isDenied(
  clientAddress: string,
  address: string,
): Promise<boolean> {
  return await XMTPModule.isDenied(clientAddress, address);
}

export function denyContacts(
  clientAddress: string,
  addresses: string[],
) {
  XMTPModule.denyContacts(clientAddress, addresses);
}

export function allowContacts(
  clientAddress: string,
  addresses: string[],
) {
  XMTPModule.allowContacts(clientAddress, addresses);
}

export function refreshConsentList(
  clientAddress: string
) {
  XMTPModule.refreshConsentList(clientAddress);
}

export const emitter = new EventEmitter(XMTPModule ?? NativeModulesProxy.XMTP);

export { Client } from "./lib/Client";
export { Conversation } from "./lib/Conversation";
export * from "./XMTP.types";
export { Query } from "./lib/Query";
export { XMTPPush } from "./lib/XMTPPush";
