/* eslint-disable @typescript-eslint/no-extra-non-null-assertion */
import { Client, Dm, Group } from 'xmtp-react-native-sdk'

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

async function createDms(
  client: Client,
  peers: Client[],
  numMessages: number
): Promise<Dm[]> {
  const dms = []
  for (let i = 0; i < peers.length; i++) {
    const dm = await peers[i].conversations.findOrCreateDm(client.address)
    dms.push(dm)
    for (let i = 0; i < numMessages; i++) {
      await dm.send({ text: `Alix message ${i}` })
    }
  }
  return dms
}

let alixClient: Client
let boClient: Client
let initialPeers: Client[]
let initialGroups: Group[]
// let initialDms: Dm[]

async function beforeAll(
  groupSize: number = 1,
  messages: number = 1,
  peersSize: number = 1,
  includeDms: boolean = false
) {
  ;[alixClient] = await createClients(1)

  initialPeers = await createClients(peersSize)
  boClient = initialPeers[0]

  initialGroups = await createGroups(
    alixClient,
    initialPeers,
    groupSize,
    messages
  )

  if (includeDms) {
    await createDms(alixClient, initialPeers, messages)
  }
}

test('test compare V3 dms', async () => {
  await beforeAll(0, 0, 50, true)
  let start = Date.now()
  await alixClient.conversations.sync()
  let end = Date.now()
  console.log(`Davon synced ${50} Dms in ${end - start}ms`)

  start = Date.now()
  let dms = await alixClient.conversations.list()
  end = Date.now()
  console.log(`Davon loaded ${dms.length} Dms in ${end - start}ms`)

  await createDms(alixClient, await createClients(5), 1)

  start = Date.now()
  await alixClient.conversations.sync()
  end = Date.now()
  console.log(`Davon synced ${dms.length} Dms in ${end - start}ms`)

  start = Date.now()
  dms = await alixClient.conversations.list()
  end = Date.now()
  console.log(`Davon loaded ${dms.length} Dms in ${end - start}ms`)

  return true
})

test('testing large group listings with ordering', async () => {
  await beforeAll(1000, 10, 10)

  let start = Date.now()
  let groups = await alixClient.conversations.listGroups()
  let end = Date.now()
  console.log(`Alix loaded ${groups.length} groups in ${end - start}ms`)

  await groups[5].send({ text: `Alix message` })
  await groups[50].send({ text: `Alix message` })
  await groups[150].send({ text: `Alix message` })
  await groups[500].send({ text: `Alix message` })
  await groups[700].send({ text: `Alix message` })
  await groups[900].send({ text: `Alix message` })

  let start2 = Date.now()
  let groups2 = await alixClient.conversations.listGroups(
    {
      consentState: false,
      description: false,
      addedByInboxId: false,
      isActive: false,
      lastMessage: true,
    },
    'lastMessage'
  )
  let end2 = Date.now()
  console.log(`Alix loaded ${groups2.length} groups in ${end2 - start2}ms`)
  assert(
    end2 - start2 < end - start,
    'listing 1000 groups without certain fields should take less time'
  )

  start = Date.now()
  await alixClient.conversations.sync()
  end = Date.now()
  console.log(`Alix synced ${groups.length} groups in ${end - start}ms`)
  assert(
    end - start < 100,
    'syncing 1000 cached groups should take less than a .1 second'
  )

  start = Date.now()
  await boClient.conversations.sync()
  end = Date.now()
  console.log(`Bo synced ${groups.length} groups in ${end - start}ms`)

  start = Date.now()
  await boClient.conversations.syncAllConversations()
  end = Date.now()
  console.log(`Bo synced all ${groups.length} groups in ${end - start}ms`)
  assert(
    end - start < 30000,
    'Syncing all 1000 groups should take less than a 30 second'
  )

  start = Date.now()
  groups = await boClient.conversations.listGroups()
  end = Date.now()
  console.log(`Bo loaded ${groups.length} groups in ${end - start}ms`)

  start2 = Date.now()
  groups2 = await boClient.conversations.listGroups(
    {
      consentState: false,
      description: false,
      addedByInboxId: false,
      isActive: false,
      lastMessage: true,
    },
    'lastMessage'
  )
  end2 = Date.now()
  console.log(`Bo loaded ${groups2.length} groups in ${end2 - start2}ms`)
  assert(
    end2 - start2 < end - start,
    'listing 1000 groups without certain fields should take less time'
  )

  return true
})

test('testing large group listings', async () => {
  await beforeAll(1000)

  let start = Date.now()
  let groups = await alixClient.conversations.listGroups()
  let end = Date.now()
  console.log(`Alix loaded ${groups.length} groups in ${end - start}ms`)
  assert(
    end - start < 3000,
    'listing 1000 groups should take less than a 3 second'
  )

  start = Date.now()
  await alixClient.conversations.sync()
  end = Date.now()
  console.log(`Alix synced ${groups.length} groups in ${end - start}ms`)
  assert(
    end - start < 100,
    'syncing 1000 cached groups should take less than a .1 second'
  )

  start = Date.now()
  await boClient.conversations.sync()
  end = Date.now()
  console.log(`Bo synced ${groups.length} groups in ${end - start}ms`)
  assert(
    end - start < 6000,
    'syncing 1000 groups should take less than a 6 second'
  )

  start = Date.now()
  groups = await boClient.conversations.listGroups()
  end = Date.now()
  console.log(`Bo loaded ${groups.length} groups in ${end - start}ms`)
  assert(
    end - start < 3000,
    'loading 1000 groups should take less than a 3 second'
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
    end - start < 1000,
    'listing 2000 self messages should take less than a 1 second'
  )

  start = Date.now()
  await alixGroup.sync()
  end = Date.now()
  console.log(`Alix synced ${messages.length} messages in ${end - start}ms`)
  assert(
    end - start < 100,
    'syncing 2000 self messages should take less than a .1 second'
  )

  await boClient.conversations.sync()
  const boGroup = await boClient.conversations.findGroup(alixGroup.id)
  start = Date.now()
  await boGroup!.sync()
  end = Date.now()
  console.log(`Bo synced ${messages.length} messages in ${end - start}ms`)
  assert(
    end - start < 3000,
    'syncing 2000 messages should take less than a 3 second'
  )

  start = Date.now()
  messages = await boGroup!.messages()
  end = Date.now()
  console.log(`Bo loaded ${messages.length} messages in ${end - start}ms`)
  assert(
    end - start < 1000,
    'loading 2000 messages should take less than a 1 second'
  )

  return true
})

test('testing large member listings', async () => {
  await beforeAll(1, 1, 50)

  const alixGroup = initialGroups[0]
  let start = Date.now()
  let members = await alixGroup.members
  let end = Date.now()
  console.log(`Alix loaded ${members.length} members in ${end - start}ms`)
  assert(
    end - start < 100,
    'listing 50 members should take less than a .1 second'
  )

  start = Date.now()
  await alixGroup.sync()
  end = Date.now()
  console.log(`Alix synced ${members.length} members in ${end - start}ms`)
  assert(
    end - start < 100,
    'syncing 50 members should take less than a .1 second'
  )

  await boClient.conversations.sync()
  const boGroup = await boClient.conversations.findGroup(alixGroup.id)
  start = Date.now()
  await boGroup!.sync()
  end = Date.now()
  console.log(`Bo synced ${members.length} members in ${end - start}ms`)
  assert(
    end - start < 100,
    'syncing 50 members should take less than a .1 second'
  )

  start = Date.now()
  members = await boGroup!.members
  end = Date.now()
  console.log(`Bo loaded ${members.length} members in ${end - start}ms`)
  assert(
    end - start < 100,
    'loading 50 members should take less than a .1 second'
  )

  const [davonClient] = await createClients(1)

  start = Date.now()
  await alixGroup.addMembers([davonClient.address])
  end = Date.now()
  console.log(`Alix added 1 member in ${end - start}ms`)
  assert(end - start < 100, 'adding 1 member should take less than a .1 second')

  start = Date.now()
  members = await alixGroup.members
  end = Date.now()
  console.log(`Alix loaded ${members.length} members in ${end - start}ms`)
  assert(
    end - start < 100,
    'loading 50 member should take less than a .1 second'
  )

  start = Date.now()
  await boGroup!.sync()
  end = Date.now()
  console.log(`Bo synced ${members.length} members in ${end - start}ms`)
  assert(
    end - start < 100,
    'syncing 50 member should take less than a .1 second'
  )

  start = Date.now()
  members = await boGroup!.members
  end = Date.now()
  console.log(`Bo loaded ${members.length} members in ${end - start}ms`)
  assert(
    end - start < 100,
    'loading 50 member should take less than a .1 second'
  )

  return true
})

test('testing sending message in large group', async () => {
  await beforeAll(1, 2000, 100)

  const alixGroup = initialGroups[0]
  let start = Date.now()
  await alixGroup.send({ text: `Alix message` })
  let end = Date.now()
  console.log(`Alix sent a message in ${end - start}ms`)
  assert(
    end - start < 200,
    'sending a message should take less than a .2 second'
  )

  await boClient.conversations.sync()
  const boGroup = await boClient.conversations.findGroup(alixGroup.id)
  start = Date.now()
  await boGroup!.prepareMessage({ text: `Bo message` })
  end = Date.now()
  console.log(`Bo sent a message in ${end - start}ms`)
  assert(
    end - start < 100,
    'preparing a message should take less than a .1 second'
  )

  start = Date.now()
  await boGroup!.sync()
  end = Date.now()
  console.log(`Bo synced messages in ${end - start}ms`)
  assert(
    end - start < 9000,
    'syncing 2000 messages should take less than a 9 second'
  )

  start = Date.now()
  await boGroup!.send({ text: `Bo message 2` })
  end = Date.now()
  console.log(`Bo sent a message in ${end - start}ms`)
  assert(
    end - start < 100,
    'sending a message should take less than a .1 second'
  )

  return true
})
