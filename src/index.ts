import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to XMTP.web.ts
// and on native platforms to XMTP.ts
import XMTPModule from './XMTPModule';
import XMTPView from './XMTPView';
import { ChangeEventPayload, XMTPViewProps } from './XMTP.types';

// Get the native constant value.
export const PI = XMTPModule.PI;

export function hello(): string {
  return XMTPModule.hello();
}

export async function setValueAsync(value: string) {
  return await XMTPModule.setValueAsync(value);
}

const emitter = new EventEmitter(XMTPModule ?? NativeModulesProxy.XMTP);

export function addChangeListener(listener: (event: ChangeEventPayload) => void): Subscription {
  return emitter.addListener<ChangeEventPayload>('onChange', listener);
}

export { XMTPView, XMTPViewProps, ChangeEventPayload };
