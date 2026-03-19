import { NativeModulesProxy, requireNativeModule } from 'expo-modules-core'

import type {
  NativeXMTPArchitectureDiagnostics,
  XMTPModuleAccess,
} from './lib/XMTPArchitectureDiagnostics'

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
const XMTPModule = requireNativeModule('XMTP')

export function getXMTPModuleAccess(): XMTPModuleAccess {
  if ((globalThis as any).expo?.modules?.XMTP) {
    return 'jsi'
  }

  if (NativeModulesProxy.XMTP) {
    return 'bridge'
  }

  return 'bridge'
}

export function getNativeArchitectureDiagnostics(): Promise<NativeXMTPArchitectureDiagnostics> {
  return XMTPModule.getArchitectureDiagnostics()
}

export default XMTPModule
