import 'react-native-url-polyfill/auto'
import { randomUUID } from 'expo-crypto'
import { polyfillWebCrypto } from 'expo-standard-web-crypto'

polyfillWebCrypto()
crypto.randomUUID = randomUUID
