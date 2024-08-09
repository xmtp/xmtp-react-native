/* eslint-disable @typescript-eslint/no-extra-non-null-assertion */
import { Wallet } from 'ethers'
import { Client, Group } from 'xmtp-react-native-sdk'

import { Test, assert, createClients } from './test-utils'

export const groupPerformanceTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  groupPerformanceTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

async function createGroups(
  client: Client,
  peers: Client[],
  numGroups: number,
  numMessages: number
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
    for (let i = 0; i < numMessages; i++) {
      await group.send({ text: `Alix message ${i}` })
    }
  }
  return groups
}

async function createMessages(
  group: Group,
  numMessages: number,
  name: string
): Promise<number> {
  let messages = 0
  for (let i = 0; i < numMessages; i++) {
    await group.send({ text: `${name} Message ${i}` })
    messages++
  }
  return messages
}

let keyBytes: Uint8Array
let alixWallet: Wallet
let boWallet: Wallet
let alixClient: Client
let boClient: Client
let caroClient: Client
let davonClient: Client
let eriClient: Client
let frankieClient: Client
let initialPeers: Client[]
let initialGroups: Group[]
let groupCallbacks = 0
let messageCallbacks = 0
let boGroupCallbacks = 0
let boMessageCallbacks = 0


async function beforeAll() {
  keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  alixWallet = new Wallet(
    '0xc54c62dd3ad018ef94f20f0722cae33919e65270ad74f2d1794291088800f788'
  )
  boWallet = new Wallet(
    '0x8d40c1c40473975cc6bbdc0465e70cc2e98f45f3c3474ca9b809caa9c4f53c0b'
  )
  alixClient = await Client.create(alixWallet, {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: keyBytes,
  })
  boClient = await Client.create(boWallet, {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: keyBytes,
  })

  await alixClient.conversations.streamGroups(async () => {
    groupCallbacks++
  })

  await alixClient.conversations.streamAllMessages(async () => {
    messageCallbacks++
  }, true)

  await boClient.conversations.streamGroups(async () => {
    boGroupCallbacks++
  })

  await boClient.conversations.streamAllMessages(async () => {
    boMessageCallbacks++
  }, true)

  initialPeers = await createClients(20)
  caroClient = initialPeers[0]
  davonClient = initialPeers[1]
  eriClient = initialPeers[2]
  frankieClient = initialPeers[3]

  initialPeers.push(boClient)
  initialGroups = await createGroups(alixClient, initialPeers, 10, 10)
}

// test('testing large group listings', async () => {
//   await beforeAll()
//   console.log(`Alix Streamed ${groupCallbacks} groups`)
//   console.log(`Alix Streamed ${messageCallbacks} messages`)
//   console.log(`Bo Streamed ${groupCallbacks} groups`)
//   console.log(`Bo Streamed ${messageCallbacks} messages`)

//   let start = Date.now()
//   let groups = await alixClient.conversations.listGroups()
//   let end = Date.now()
//   console.log(`Alix loaded ${groups.length} groups in ${end - start}ms`)

//   start = Date.now()
//   await alixClient.conversations.syncGroups()
//   end = Date.now()
//   console.log(`Alix synced ${groups.length} groups in ${end - start}ms`)

//   start = Date.now()
//   await boClient.conversations.syncGroups()
//   end = Date.now()
//   console.log(`Bo synced ${groups.length} groups in ${end - start}ms`)

//   start = Date.now()
//   groups = await boClient.conversations.listGroups()
//   end = Date.now()
//   console.log(`Bo loaded ${groups.length} groups in ${end - start}ms`)

//   start = Date.now()
//   await caroClient.conversations.syncGroups()
//   end = Date.now()
//   console.log(`Caro synced ${groups.length} groups in ${end - start}ms`)

//   start = Date.now()
//   groups = await caroClient.conversations.listGroups()
//   end = Date.now()
//   console.log(`Caro loaded ${groups.length} groups in ${end - start}ms`)

//   return true
// })

// test('testing large member listings', async () => {
//   const alixGroup = initialGroups[0]

//   let start = Date.now()
//   let members = await alixGroup.members()
//   let end = Date.now()
//   console.log(`Alix loaded ${members.length} members in ${end - start}ms`)

//   await boClient.conversations.syncGroups()
//   await caroClient.conversations.syncGroups()

//   let boGroup = await boClient.conversations.findGroup(alixGroup.id)
//   const caroGroup = await caroClient.conversations.findGroup(alixGroup.id)

//   start = Date.now()
//   await boGroup!.sync()
//   end = Date.now()
//   console.log(`Bo synced group in ${end - start}ms`)

//   start = Date.now()
//   members = await boGroup!.members()
//   end = Date.now()
//   console.log(`Bo loaded ${members.length} members in ${end - start}ms`)

//   start = Date.now()
//   await caroGroup!.sync()
//   end = Date.now()
//   console.log(`Caro synced group in ${end - start}ms`)

//   start = Date.now()
//   members = await caroGroup!.members()
//   end = Date.now()
//   console.log(`Caro loaded ${members.length} members in ${end - start}ms`)

//   await boClient.dropLocalDatabaseConnection()
//   await boClient.deleteLocalDatabase()

//   // Recreating a client with wallet 2 (new installation!)
//   boClient = await Client.create(boWallet, {
//     env: 'local',
//     appVersion: 'Testing/0.0.0',
//     enableV3: true,
//     dbEncryptionKey: keyBytes,
//   })

//   await createMessages(caroGroup!!, 5, 'Caro')

//   await boClient.dropLocalDatabaseConnection()
//   await boClient.deleteLocalDatabase()

//   // Recreating a client with wallet 2 (new installation!)
//   boClient = await Client.create(boWallet, {
//     env: 'local',
//     appVersion: 'Testing/0.0.0',
//     enableV3: true,
//     dbEncryptionKey: keyBytes,
//   })

//   await createMessages(alixGroup!!, 5, 'Alix')

//   start = Date.now()
//   await caroGroup!.sync()
//   end = Date.now()
//   console.log(`Caro synced group in ${end - start}ms`)

//   start = Date.now()
//   members = await caroGroup!.members()
//   end = Date.now()
//   console.log(`Caro loaded ${members.length} members in ${end - start}ms`)

//   start = Date.now()
//   await alixGroup!.sync()
//   end = Date.now()
//   console.log(`Alix synced group in ${end - start}ms`)

//   start = Date.now()
//   members = await alixGroup!.members()
//   end = Date.now()
//   console.log(`Alix loaded ${members.length} members in ${end - start}ms`)

//   boGroup = await boClient.conversations.findGroup(alixGroup.id)

//   start = Date.now()
//   await boGroup!.sync()
//   end = Date.now()
//   console.log(`Bo synced group in ${end - start}ms`)

//   start = Date.now()
//   members = await boGroup!.members()
//   end = Date.now()
//   console.log(`Bo loaded ${members.length} members in ${end - start}ms`)

//   return true
// })

test('testing large groups with large members and messages performance', async () => {
  await beforeAll()
  console.log(`Alix Streamed ${groupCallbacks} groups (10)`)
  console.log(`Alix Streamed ${messageCallbacks} messages (10)`)
  console.log(`Bo Streamed ${boGroupCallbacks} groups (10)`)
  console.log(`Bo Streamed ${boMessageCallbacks} messages (10)`)
  const alixGroup = initialGroups[0]

  let start = Date.now()
  let messages = await alixGroup.messages()
  let end = Date.now()
  console.log(`Alix loaded ${messages.length} messages in ${end - start}ms (11)`)

  start = Date.now()
  await alixGroup.sync()
  end = Date.now()
  console.log(`Alix synced messages in ${end - start}ms`)

  await boClient.conversations.syncGroups()
  await caroClient.conversations.syncGroups()
  await davonClient.conversations.syncGroups()
  await eriClient.conversations.syncGroups()
  await frankieClient.conversations.syncGroups()

  const boGroup = await boClient.conversations.findGroup(alixGroup.id)
  const caroGroup = await caroClient.conversations.findGroup(alixGroup.id)
  const davonGroup = await davonClient.conversations.findGroup(alixGroup.id)
  const eriGroup = await eriClient.conversations.findGroup(alixGroup.id)
  const frankieGroup = await frankieClient.conversations.findGroup(alixGroup.id)

  start = Date.now()
  await boGroup!!.sync()
  end = Date.now()
  console.log(`Bo synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await boGroup!!.messages()
  end = Date.now()
  console.log(`Bo loaded ${messages.length} messages in ${end - start}ms (10)`)

  start = Date.now()
  await caroGroup!!.sync()
  end = Date.now()
  console.log(`Caro synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await caroGroup!!.messages()
  end = Date.now()
  console.log(`Caro loaded ${messages.length} messages in ${end - start}ms (10)`)

  await createMessages(davonGroup!!, 10, 'Davon')
  await createMessages(frankieGroup!!, 10, 'Frankie')
  await createMessages(boGroup!!, 10, 'Bo')
  await createMessages(alixGroup!!, 10, 'Alix')
  await createMessages(caroGroup!!, 10, 'Caro')
  await createMessages(eriGroup!!, 10, 'Eri')
  await createGroups(eriClient, initialPeers, 1, 10)
  await createGroups(boClient, initialPeers, 1, 10)

  start = Date.now()
  await caroGroup!!.sync()
  end = Date.now()
  console.log(`Caro synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await caroGroup!!.messages()
  end = Date.now()
  console.log(`Caro loaded ${messages.length} messages in ${end - start}ms (90)`)

  start = Date.now()
  await alixGroup.sync()
  end = Date.now()
  console.log(`Alix synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await alixGroup.messages()
  end = Date.now()
  console.log(`Alix loaded ${messages.length} messages in ${end - start}ms (91)`)

  start = Date.now()
  await davonGroup!!.sync()
  end = Date.now()
  console.log(`Davon synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await davonGroup!!.messages()
  end = Date.now()
  console.log(`Davon loaded ${messages.length} messages in ${end - start}ms (90)`)

  await createMessages(davonGroup!!, 10, 'Davon')
  await createMessages(frankieGroup!!, 10, 'Frankie')
  await createMessages(boGroup!!, 10, 'Bo')
  await createMessages(alixGroup!!, 10, 'Alix')
  await createMessages(caroGroup!!, 10, 'Caro')

  start = Date.now()
  await caroGroup!!.sync()
  end = Date.now()
  console.log(`Caro synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await caroGroup!!.messages()
  end = Date.now()
  console.log(`Caro loaded ${messages.length} messages in ${end - start}ms (140)`)

  start = Date.now()
  await alixGroup.sync()
  end = Date.now()
  console.log(`Alix synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await alixGroup.messages()
  end = Date.now()
  console.log(`Alix loaded ${messages.length} messages in ${end - start}ms (141)`)

  start = Date.now()
  await davonGroup!!.sync()
  end = Date.now()
  console.log(`Davon synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await davonGroup!!.messages()
  end = Date.now()
  console.log(`Davon loaded ${messages.length} messages in ${end - start}ms (140)`)

  start = Date.now()
  await eriGroup!!.sync()
  end = Date.now()
  console.log(`Eri synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await eriGroup!!.messages()
  end = Date.now()
  console.log(`Eri loaded ${messages.length} messages in ${end - start}ms (140)`)

  console.log(`Alix Streamed ${groupCallbacks} groups (12)`)
  console.log(`Alix Streamed ${messageCallbacks} messages (140)`)
  console.log(`Bo Streamed ${boGroupCallbacks} groups (12)`)
  console.log(`Bo Streamed ${boMessageCallbacks} messages (140)`)

  return true
})
