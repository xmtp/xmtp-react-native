import { Wallet } from 'ethers'
import { Platform } from 'expo-modules-core'
import { DecodedMessage } from 'xmtp-react-native-sdk/lib/DecodedMessage'

import {
  Test,
  assert,
  createClients,
  delayToPropogate,
} from './test-utils'
import {
  Client,
  Conversation,
  Dm,
  Group,
  ConversationContainer,
  ConversationVersion,
} from '../../../src/index'

export const dmTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  dmTests.push({ name: String(counter++) + '. ' + name, run: perform })
}
