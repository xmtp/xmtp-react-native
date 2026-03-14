import { Wallet } from 'ethers'
import { Platform } from 'expo-modules-core'
import Config from 'react-native-config'
import {
  Client,
  GroupUpdatedCodec,
  Group,
  RemoteAttachmentCodec,
  XMTPEnvironment,
  Signer,
  ReactionCodec,
  ReactionV2Codec,
  MultiRemoteAttachmentCodec,
  PublicIdentity,
  JSContentCodec,
  LeaveRequestCodec,
  DeleteMessageCodec,
  ReplyCodec,
} from 'xmtp-react-native-sdk'

import { getTestEnv } from '../testEnv'

// Debug logging state
let debugLoggingEnabled = false

export function setDebugLoggingEnabled(enabled: boolean) {
  debugLoggingEnabled = enabled
}

export function getDebugLoggingEnabled(): boolean {
  return debugLoggingEnabled
}

export function debugLog(...args: any[]) {
  if (debugLoggingEnabled) {
    console.log(...args)
  }
}

export type Test = {
  name: string
  run: () => Promise<boolean>
}

export function isIos() {
  return Platform.OS === 'ios'
}

export async function delayToPropogate(milliseconds = 100): Promise<void> {
  // delay avoid clobbering
  return new Promise((r) => setTimeout(r, milliseconds))
}

export function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(msg)
  }
}

export async function createClients(
  numClients: number,
  env?: XMTPEnvironment | undefined,
  customCodecs?: JSContentCodec<any>[]
): Promise<Client[]> {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  let resolvedEnv: XMTPEnvironment
  let gatewayHost: string | undefined
  if (env !== undefined) {
    resolvedEnv = env
  } else {
    const testEnvOption = getTestEnv()
    if (testEnvOption === 'd14n') {
      debugLog('Using d14n test environment')
      resolvedEnv = 'dev'
      gatewayHost = Config.GATEWAY_HOST
      if (!gatewayHost) {
        throw new Error(
          'Test env is "d14n" but GATEWAY_HOST is not set. Copy EXAMPLE.env to .env, set GATEWAY_HOST, and rebuild the app.'
        )
      }
    } else {
      resolvedEnv = testEnvOption
    }
  }

  const clients = []
  for (let i = 0; i < numClients; i++) {
    const client = await Client.createRandom({
      env: resolvedEnv,
      dbEncryptionKey: keyBytes,
      ...(gatewayHost !== undefined && { gatewayHost }),
    })
    Client.register(new GroupUpdatedCodec())
    Client.register(new RemoteAttachmentCodec())
    Client.register(new MultiRemoteAttachmentCodec())
    Client.register(new ReactionCodec())
    Client.register(new ReactionV2Codec())
    Client.register(new LeaveRequestCodec())
    Client.register(new DeleteMessageCodec())
    Client.register(new ReplyCodec())
    for (const codec of customCodecs ?? []) {
      Client.register(codec)
    }
    clients.push(client)
  }
  return clients
}

export async function createGroups(
  client: Client,
  peers: Client[],
  numGroups: number
): Promise<Group[]> {
  const groups = []
  const inboxIds: string[] = peers.map((client) => client.inboxId)
  for (let i = 0; i < numGroups; i++) {
    const group = await client.conversations.newGroup(inboxIds, {
      name: `group ${i}`,
      imageUrl: `www.group${i}.com`,
      description: `group ${i}`,
    })
    groups.push(group)
  }
  return groups
}

export function adaptEthersWalletToSigner(wallet: Wallet): Signer {
  return {
    getIdentifier: async () => new PublicIdentity(wallet.address, 'ETHEREUM'),
    getChainId: () => undefined, // Provide a chain ID if available or return undefined
    getBlockNumber: () => undefined, // Block number is typically not available in Wallet, return undefined
    signerType: () => 'EOA', // "EOA" indicates an externally owned account
    signMessage: async (message: string) => {
      debugLog('attempting tosignMessage', message)
      try {
        const signature = await wallet.signMessage(message)
        debugLog('signature', signature)
        return {
          signature,
        }
      } catch (error) {
        debugLog('error', error)
        throw error
      }
    },
  }
}

export async function assertEqual(actual: any, expected: any, message: string) {
  const resolvedActual = typeof actual === 'function' ? await actual() : actual

  assert(
    resolvedActual === expected,
    `${message} Expected: ${expected}, but was: ${resolvedActual}`
  )
}
