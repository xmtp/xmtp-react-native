/* eslint-disable @typescript-eslint/no-extra-non-null-assertion */
import { Client, Group } from 'xmtp-react-native-sdk'

import { Test, assert, createClients } from './test-utils'

export const v3OnlyTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  v3OnlyTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('can make a V3 only client', async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const client = await Client.createRandomV3({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: keyBytes,
  })

  const inboxId = await Client.getOrCreateInboxId(client.address, {
    env: 'local',
  })

  assert(
    client.inboxId === inboxId,
    `inboxIds should match but were ${client.inboxId} and ${inboxId}`
  )
  const canMessageV2 = await client.canMessage(client.address)
  assert(canMessageV2 === false, `canMessageV2 should be false`)
  const canMessageV3 = await client.canGroupMessage([client.address])

  assert(
    canMessageV3[client.address.toLowerCase()] === true,
    `canMessageV3 should be true`
  )

  return true
})

test('can create group', async () => {

  return true
})

test('can send message', async () => {

  return true
})

test('can stream all messages', async () => {

  return true
})

test('can stream groups and conversations', async () => {

  return true
})
