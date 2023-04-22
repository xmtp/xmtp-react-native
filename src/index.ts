import { NativeModulesProxy, EventEmitter } from "expo-modules-core";
import type { Conversation } from "./lib/Conversation";

// Import the native module. On web, it will be resolved to XMTP.web.ts
// and on native platforms to XMTP.ts
import XMTPModule from "./XMTPModule";

export function address(): string {
  return XMTPModule.address();
}

export async function auth(address: string) {
  return await XMTPModule.auth(address);
}

export async function receiveSignature(requestID: string, signature: string) {
  return await XMTPModule.receiveSignature(requestID, signature);
}

export async function listConversations(): Promise<Conversation[]> {
  return (await XMTPModule.listConversations()).map((json: string) => {
    return JSON.parse(json);
  });
}

export const emitter = new EventEmitter(XMTPModule ?? NativeModulesProxy.XMTP);

export { Client } from "./lib/Client";
export { Conversation } from "./lib/Conversation";
