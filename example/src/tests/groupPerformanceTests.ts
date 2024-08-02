import { group } from 'console'
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
      await group.send({ text: `Message ${i}` })
    }
  }
  return groups
}

async function createMessages(
  group: Group,
  numMessages: number
): Promise<number> {
  let messages = 0
  for (let i = 0; i < numMessages; i++) {
    await group.send({ text: `Message ${i}` })
    messages++
  }
  return messages
}

// test('testing large group listing with metadata performance', async () => {
//   const [alixClient, boClient] = await createClients(2)

//   await createGroups(alixClient, [boClient], 10)

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

//   return true
// })

test('testing large groups with large members and messages performance', async () => {
  const [alixClient] = await createClients(1)
  const peers = await createClients(10)
  const boClient = peers[0]
  const caroClient = peers[1]
  const davonClient = peers[2]
  const eriClient = peers[3]
  const frankieClient = peers[4]

  const [alixGroup] = await createGroups(alixClient, peers, 1, 100)

  let start = Date.now()
  let messages = await alixGroup.messages()
  let end = Date.now()
  console.log(`Alix loaded ${messages.length} messages in ${end - start}ms`)

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
  console.log(`Bo loaded ${messages.length} messages in ${end - start}ms`)

  start = Date.now()
  await caroGroup!!.sync()
  end = Date.now()
  console.log(`Caro synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await caroGroup!!.messages()
  end = Date.now()
  console.log(`Caro loaded ${messages.length} messages in ${end - start}ms`)

  await createMessages(davonGroup!!, 50)
  await createMessages(frankieGroup!!, 50)
  await createMessages(boGroup!!, 50)
  await createMessages(alixGroup!!, 50)
  await createMessages(caroGroup!!, 50)
  await createMessages(eriGroup!!, 50)

  start = Date.now()
  await caroGroup!!.sync()
  end = Date.now()
  console.log(`Caro synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await caroGroup!!.messages()
  end = Date.now()
  console.log(`Caro loaded ${messages.length} messages in ${end - start}ms`)

  start = Date.now()
  await alixGroup.sync()
  end = Date.now()
  console.log(`Alix synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await alixGroup.messages()
  end = Date.now()
  console.log(`Alix loaded ${messages.length} messages in ${end - start}ms`)

  start = Date.now()
  await davonGroup!!.sync()
  end = Date.now()
  console.log(`Davon synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await davonGroup!!.messages()
  end = Date.now()
  console.log(`Davon loaded ${messages.length} messages in ${end - start}ms`)

  await createMessages(davonGroup!!, 50)
  await createMessages(frankieGroup!!, 50)
  await createMessages(boGroup!!, 50)
  await createMessages(alixGroup!!, 50)
  await createMessages(caroGroup!!, 50)

  start = Date.now()
  await caroGroup!!.sync()
  end = Date.now()
  console.log(`Caro synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await caroGroup!!.messages()
  end = Date.now()
  console.log(`Caro loaded ${messages.length} messages in ${end - start}ms`)

  start = Date.now()
  await alixGroup.sync()
  end = Date.now()
  console.log(`Alix synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await alixGroup.messages()
  end = Date.now()
  console.log(`Alix loaded ${messages.length} messages in ${end - start}ms`)

  start = Date.now()
  await davonGroup!!.sync()
  end = Date.now()
  console.log(`Davon synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await davonGroup!!.messages()
  end = Date.now()
  console.log(`Davon loaded ${messages.length} messages in ${end - start}ms`)

  start = Date.now()
  await eriGroup!!.sync()
  end = Date.now()
  console.log(`Eri synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await eriGroup!!.messages()
  end = Date.now()
  console.log(`Eri loaded ${messages.length} messages in ${end - start}ms`)

  return true
})
