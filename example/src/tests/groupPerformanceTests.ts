import { group } from 'console'
import { Client } from 'xmtp-react-native-sdk'

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
  numGroups: number
): Promise<number> {
  let groups = 0
  const addresses: string[] = peers.map((client) => client.address)
  for (let i = 0; i < numGroups; i++) {
    await client.conversations.newGroup(addresses, {
      // name: `group ${groups}`,
      // imageUrlSquare: `www.group${groups}.com`,
      // description: `group ${group}`,
    })

    groups++
  }
  return groups
}

test('testing large group listing with metadata performance', async () => {
  const [alixClient, boClient] = await createClients(2)

  await createGroups(alixClient, [boClient], 10)

  let start = Date.now()
  let groups = await alixClient.conversations.listGroups()
  let end = Date.now()
  console.log(`Alix loaded ${groups.length} groups in ${end - start}ms`)

  start = Date.now()
  await alixClient.conversations.syncGroups()
  end = Date.now()
  console.log(`Alix synced ${groups.length} groups in ${end - start}ms`)

  start = Date.now()
  await boClient.conversations.syncGroups()
  end = Date.now()
  console.log(`Bo synced ${groups.length} groups in ${end - start}ms`)

  start = Date.now()
  groups = await boClient.conversations.listGroups()
  end = Date.now()
  console.log(`Bo loaded ${groups.length} groups in ${end - start}ms`)

  return true
})

test('testing large group listing with members performance', async () => {
  const [alixClient] = await createClients(1)
  const peers = await createClients(20)

  await createGroups(alixClient, peers, 5)

  let start = Date.now()
  let groups = await alixClient.conversations.listGroups()
  let end = Date.now()
  console.log(`Alix loaded ${groups.length} groups in ${end - start}ms`)

  start = Date.now()
  await alixClient.conversations.syncGroups()
  end = Date.now()
  console.log(`Alix synced ${groups.length} groups in ${end - start}ms`)

  start = Date.now()
  await peers[0].conversations.syncGroups()
  end = Date.now()
  console.log(`Bo synced ${groups.length} groups in ${end - start}ms`)

  start = Date.now()
  groups = await peers[0].conversations.listGroups()
  end = Date.now()
  console.log(`Bo loaded ${groups.length} groups in ${end - start}ms`)

  return true
})
