declare module 'react-native-config' {
  export interface NativeConfig {
    THIRD_WEB_CLIENT_ID?: string
    TEST_PRIVATE_KEY?: string
    TEST_V3_PRIVATE_KEY?: string
  }

  export const Config: NativeConfig
  export default Config
}
