import { Wallet } from 'ethers'
import { Platform } from 'expo-modules-core'
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
} from 'xmtp-react-native-sdk'

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
  env?: XMTPEnvironment | undefined
): Promise<Client[]> {
  const clients = []
  for (let i = 0; i < numClients; i++) {
    const keyBytes = new Uint8Array([
      233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
      166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135,
      145,
    ])
    const client = await Client.createRandom({
      env: env ?? 'local',
      dbEncryptionKey: keyBytes,
    })
    Client.register(new GroupUpdatedCodec())
    Client.register(new RemoteAttachmentCodec())
    Client.register(new MultiRemoteAttachmentCodec())
    Client.register(new ReactionCodec())
    Client.register(new ReactionV2Codec())
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
  const addresses: string[] = peers.map((client) => client.address)
  for (let i = 0; i < numGroups; i++) {
    const group = await client.conversations.newGroup(addresses, {
      name: `group ${i}`,
      imageUrlSquare: `www.group${i}.com`,
      description: `group ${i}`,
    })
    groups.push(group)
  }
  return groups
}

export function adaptEthersWalletToSigner(wallet: Wallet): Signer {
  return {
    getAddress: async () => wallet.address,
    getChainId: () => undefined, // Provide a chain ID if available or return undefined
    getBlockNumber: () => undefined, // Block number is typically not available in Wallet, return undefined
    walletType: () => 'EOA', // "EOA" indicates an externally owned account
    signMessage: async (message: string) => wallet.signMessage(message),
  }
}

export async function assertEqual(actual: any, expected: any, message: string) {
  const resolvedActual = typeof actual === 'function' ? await actual() : actual;
  assert(
    resolvedActual === expected,
    `${message} Expected: ${expected}, but was: ${resolvedActual}`
  )
}
