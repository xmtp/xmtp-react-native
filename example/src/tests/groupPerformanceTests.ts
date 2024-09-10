/* eslint-disable @typescript-eslint/no-extra-non-null-assertion */
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

let alixClient: Client
let boClient: Client
let initialPeers: Client[]
let initialGroups: Group[]

async function beforeAll(
  groupSize: number = 10,
  groupMessages: number = 10,
  peersSize: number = 10
) {
  ;[alixClient] = await createClients(1)

  initialPeers = await createClients(peersSize)
  boClient = initialPeers[0]

  initialGroups = await createGroups(
    alixClient,
    initialPeers,
    groupSize,
    groupMessages
  )
}

test('testing large group listings', async () => {
  await beforeAll(1000)

  let start = Date.now()
  let groups = await alixClient.conversations.listGroups()
  let end = Date.now()
  console.log(`Alix loaded ${groups.length} groups in ${end - start}ms`)
  assert(
    end - start < 2000,
    'listing 1000 groups should take less than a 2 second'
  )

  start = Date.now()
  await alixClient.conversations.syncGroups()
  end = Date.now()
  console.log(`Alix synced ${groups.length} groups in ${end - start}ms`)
  assert(
    end - start < 100,
    'syncing 1000 cached groups should take less than a .1 second'
  )

  start = Date.now()
  await boClient.conversations.syncGroups()
  end = Date.now()
  console.log(`Bo synced ${groups.length} groups in ${end - start}ms`)
  assert(
    end - start < 5000,
    'syncing 1000 groups should take less than a 5 second'
  )

  start = Date.now()
  groups = await boClient.conversations.listGroups()
  end = Date.now()
  console.log(`Bo loaded ${groups.length} groups in ${end - start}ms`)
  assert(
    end - start < 2000,
    'loading 1000 groups should take less than a 2 second'
  )

  return true
})

test('testing large message listings', async () => {
  await beforeAll(1, 2000)

  const alixGroup = initialGroups[0]
  let start = Date.now()
  let messages = await alixGroup.messages()
  let end = Date.now()
  console.log(`Alix loaded ${messages.length} messages in ${end - start}ms`)
  assert(
    end - start < 200,
    'listing 2000 self messages should take less than a .2 second'
  )

  start = Date.now()
  await alixGroup.sync()
  end = Date.now()
  console.log(`Alix synced ${messages.length} messages in ${end - start}ms`)
  assert(
    end - start < 100,
    'syncing 2000 self messages should take less than a .1 second'
  )

  await boClient.conversations.syncGroups()
  const boGroup = await boClient.conversations.findGroup(alixGroup.id)
  start = Date.now()
  await boGroup!.sync()
  end = Date.now()
  console.log(`Bo synced ${messages.length} messages in ${end - start}ms`)
  assert(
    end - start < 1000,
    'syncing 2000 messages should take less than a 1 second'
  )

  start = Date.now()
  messages = await boGroup!.messages()
  end = Date.now()
  console.log(`Bo loaded ${messages.length} messages in ${end - start}ms`)
  assert(
    end - start < 200,
    'loading 2000 messages should take less than a .2 second'
  )

  return true
})

test('testing large member listings', async () => {
  await beforeAll(1, 100, 1000)

  const alixGroup = initialGroups[0]
  let start = Date.now()
  let members = await alixGroup.members
  let end = Date.now()
  console.log(`Alix loaded ${members.length} members in ${end - start}ms`)
  assert(
    end - start < 2000,
    'listing 2000 members should take less than a 2 second'
  )

  start = Date.now()
  await alixGroup.sync()
  end = Date.now()
  console.log(`Alix synced ${members.length} members in ${end - start}ms`)

  await boClient.conversations.syncGroups()
  const boGroup = await boClient.conversations.findGroup(alixGroup.id)
  start = Date.now()
  await boGroup!.sync()
  end = Date.now()
  console.log(`Bo synced ${members.length} members in ${end - start}ms`)

  start = Date.now()
  members = await boGroup!.members
  end = Date.now()
  console.log(`Bo loaded ${members.length} members in ${end - start}ms`)

  const [davonClient] = await createClients(1)

  start = Date.now()
  await alixGroup.addMembers([davonClient.address])
  end = Date.now()
  console.log(`Alix added 1 member in ${end - start}ms`)

  start = Date.now()
  members = await alixGroup.members
  end = Date.now()
  console.log(`Alix loaded ${members.length} members in ${end - start}ms`)

  start = Date.now()
  await boGroup!.sync()
  end = Date.now()
  console.log(`Bo synced ${members.length} members in ${end - start}ms`)

  start = Date.now()
  members = await boGroup!.members
  end = Date.now()
  console.log(`Bo loaded ${members.length} members in ${end - start}ms`)

  return true
})

test('testing sending message in large group', async () => {
  await beforeAll(1, 2000, 1000)

  const alixGroup = initialGroups[0]
  let start = Date.now()
  await alixGroup.send({ text: `Alix message` })
  let end = Date.now()
  console.log(`Alix sent a message in ${end - start}ms`)
  assert(
    end - start < 1000,
    'sending a message should take less than a 1 second'
  )

  await boClient.conversations.syncGroups()
  const boGroup = await boClient.conversations.findGroup(alixGroup.id)
  start = Date.now()
  await boGroup!.send({ text: `Bo message` })
  end = Date.now()
  console.log(`Bo sent a message in ${end - start}ms`)

  start = Date.now()
  await boGroup!.sync()
  end = Date.now()
  console.log(`Bo synced messages in ${end - start}ms`)

  start = Date.now()
  await boGroup!.send({ text: `Bo message 2` })
  end = Date.now()
  console.log(`Bo sent a message in ${end - start}ms`)

  return true
})
