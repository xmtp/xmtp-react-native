import { Platform } from 'expo-modules-core'
import { Client } from 'xmtp-react-native-sdk'

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

export async function createClients(numClients: number): Promise<Client[]> {
  const clients = []
  for (let i = 0; i < numClients; i++) {
    const keyBytes = new Uint8Array([
      233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
      166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135,
      145,
    ])
    clients.push(
      await Client.createRandom({
        env: 'local',
        enableV3: true,
        dbEncryptionKey: keyBytes,
      })
    )
  }
  return clients
}
