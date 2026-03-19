export type XMTPModuleAccess = 'jsi' | 'bridge'

export type NewArchitectureFlagSource =
  | 'BuildConfig.IS_NEW_ARCHITECTURE_ENABLED'
  | 'RCT_NEW_ARCH_ENABLED'

export type NewArchitectureFlagProvider = 'host-app' | 'xmtp-module'

export interface NativeXMTPArchitectureDiagnostics {
  platform: 'android' | 'ios'
  moduleName: string
  moduleType: 'expo-module'
  moduleClassName: string
  hostAppId: string
  isNewArchitectureEnabled: boolean
  newArchitectureFlagSource: NewArchitectureFlagSource
  newArchitectureFlagProvider: NewArchitectureFlagProvider
}

export interface XMTPArchitectureDiagnostics
  extends NativeXMTPArchitectureDiagnostics {
  moduleAccess: XMTPModuleAccess
  supportsSynchronousFunctions: boolean
}

export function toArchitectureDiagnostics(
  diagnostics: NativeXMTPArchitectureDiagnostics,
  moduleAccess: XMTPModuleAccess
): XMTPArchitectureDiagnostics {
  return {
    ...diagnostics,
    moduleAccess,
    supportsSynchronousFunctions: moduleAccess === 'jsi',
  }
}
