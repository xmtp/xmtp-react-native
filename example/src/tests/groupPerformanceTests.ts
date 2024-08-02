/* eslint-disable @typescript-eslint/no-extra-non-null-assertion */
import { group } from 'console'
import Config from 'react-native-config'
import { privateKeyToAccount } from 'viem/accounts'
import { Client, Group } from 'xmtp-react-native-sdk'

import { Test, assert, createClients } from './test-utils'
import { convertPrivateKeyAccountToSigner } from './tests'
import { supportedCodecs } from '../contentTypes/contentTypes'

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

// test('testing large groups with large members and messages performance', async () => {
//   const [alixClient] = await createClients(1)
//   const peers = await createClients(10)
//   const boClient = peers[0]
//   const caroClient = peers[1]
//   const davonClient = peers[2]
//   const eriClient = peers[3]
//   const frankieClient = peers[4]

//   const [alixGroup] = await createGroups(alixClient, peers, 1, 100)

//   let start = Date.now()
//   let messages = await alixGroup.messages()
//   let end = Date.now()
//   console.log(`Alix loaded ${messages.length} messages in ${end - start}ms`)

//   start = Date.now()
//   await alixGroup.sync()
//   end = Date.now()
//   console.log(`Alix synced messages in ${end - start}ms`)

//   await boClient.conversations.syncGroups()
//   await caroClient.conversations.syncGroups()
//   await davonClient.conversations.syncGroups()
//   await eriClient.conversations.syncGroups()
//   await frankieClient.conversations.syncGroups()

//   const boGroup = await boClient.conversations.findGroup(alixGroup.id)
//   const caroGroup = await caroClient.conversations.findGroup(alixGroup.id)
//   const davonGroup = await davonClient.conversations.findGroup(alixGroup.id)
//   const eriGroup = await eriClient.conversations.findGroup(alixGroup.id)
//   const frankieGroup = await frankieClient.conversations.findGroup(alixGroup.id)

//   start = Date.now()
//   await boGroup!!.sync()
//   end = Date.now()
//   console.log(`Bo synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await boGroup!!.messages()
//   end = Date.now()
//   console.log(`Bo loaded ${messages.length} messages in ${end - start}ms`)

//   start = Date.now()
//   await caroGroup!!.sync()
//   end = Date.now()
//   console.log(`Caro synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await caroGroup!!.messages()
//   end = Date.now()
//   console.log(`Caro loaded ${messages.length} messages in ${end - start}ms`)

//   await createMessages(davonGroup!!, 50)
//   await createMessages(frankieGroup!!, 50)
//   await createMessages(boGroup!!, 50)
//   await createMessages(alixGroup!!, 50)
//   await createMessages(caroGroup!!, 50)
//   await createMessages(eriGroup!!, 50)

//   start = Date.now()
//   await caroGroup!!.sync()
//   end = Date.now()
//   console.log(`Caro synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await caroGroup!!.messages()
//   end = Date.now()
//   console.log(`Caro loaded ${messages.length} messages in ${end - start}ms`)

//   start = Date.now()
//   await alixGroup.sync()
//   end = Date.now()
//   console.log(`Alix synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await alixGroup.messages()
//   end = Date.now()
//   console.log(`Alix loaded ${messages.length} messages in ${end - start}ms`)

//   start = Date.now()
//   await davonGroup!!.sync()
//   end = Date.now()
//   console.log(`Davon synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await davonGroup!!.messages()
//   end = Date.now()
//   console.log(`Davon loaded ${messages.length} messages in ${end - start}ms`)

//   await createMessages(davonGroup!!, 50)
//   await createMessages(frankieGroup!!, 50)
//   await createMessages(boGroup!!, 50)
//   await createMessages(alixGroup!!, 50)
//   await createMessages(caroGroup!!, 50)

//   start = Date.now()
//   await caroGroup!!.sync()
//   end = Date.now()
//   console.log(`Caro synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await caroGroup!!.messages()
//   end = Date.now()
//   console.log(`Caro loaded ${messages.length} messages in ${end - start}ms`)

//   start = Date.now()
//   await alixGroup.sync()
//   end = Date.now()
//   console.log(`Alix synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await alixGroup.messages()
//   end = Date.now()
//   console.log(`Alix loaded ${messages.length} messages in ${end - start}ms`)

//   start = Date.now()
//   await davonGroup!!.sync()
//   end = Date.now()
//   console.log(`Davon synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await davonGroup!!.messages()
//   end = Date.now()
//   console.log(`Davon loaded ${messages.length} messages in ${end - start}ms`)

//   start = Date.now()
//   await eriGroup!!.sync()
//   end = Date.now()
//   console.log(`Eri synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await eriGroup!!.messages()
//   end = Date.now()
//   console.log(`Eri loaded ${messages.length} messages in ${end - start}ms`)

//   return true
// })

// test('testing large groups with large members and messages performance', async () => {
//   const keyBytes = new Uint8Array([
//     233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
//     166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
//   ])
//   if (!Config.TEST_V3_PRIVATE_KEY) {
//     throw new Error('Add V3 private key to .env file')
//   }
//   const alixPrivateKeyHex: `0x${string}` = `0x${Config.TEST_V3_PRIVATE_KEY}`

//   const alixSigner = convertPrivateKeyAccountToSigner(
//     privateKeyToAccount(alixPrivateKeyHex)
//   )

//   const boPrivateKeyHex: `0x${string}` = `0x${Config.TEST_PRIVATE_KEY}`
//   const boSigner = convertPrivateKeyAccountToSigner(
//     privateKeyToAccount(boPrivateKeyHex)
//   )
//   const alixClient = await Client.create(alixSigner, {
//     env: 'local',
//     enableV3: true,
//     dbEncryptionKey: keyBytes,
//   })

//   const boClient = await Client.create(boSigner, {
//     env: 'local',
//     enableV3: true,
//     dbEncryptionKey: keyBytes,
//   })

//   const peers = await createClients(10)
//   const caroClient = peers[1]
//   const davonClient = peers[2]
//   const eriClient = peers[3]
//   const frankieClient = peers[4]

//   const [alixGroup] = await createGroups(alixClient, peers, 1, 10)

//   let start = Date.now()
//   let messages = await alixGroup.messages()
//   let end = Date.now()
//   //11
//   console.log(`Alix loaded ${messages.length} messages in ${end - start}ms`)

//   await caroClient.conversations.syncGroups()
//   await davonClient.conversations.syncGroups()
//   await eriClient.conversations.syncGroups()
//   await frankieClient.conversations.syncGroups()

//   const caroGroup = await caroClient.conversations.findGroup(alixGroup.id)
//   const davonGroup = await davonClient.conversations.findGroup(alixGroup.id)
//   const eriGroup = await eriClient.conversations.findGroup(alixGroup.id)
//   const frankieGroup = await frankieClient.conversations.findGroup(alixGroup.id)

//   start = Date.now()
//   await caroGroup!!.sync()
//   end = Date.now()
//   console.log(`Caro synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await caroGroup!!.messages()
//   end = Date.now()
//   //10
//   console.log(`Caro loaded ${messages.length} messages in ${end - start}ms`)

//   await createMessages(davonGroup!!, 5)
//   await alixGroup.addMembers([boClient.address])
//   await createMessages(frankieGroup!!, 5)
//   await createMessages(alixGroup!!, 5)
//   await createMessages(caroGroup!!, 5)
//   await createMessages(eriGroup!!, 5)
//   //36

//   await boClient.conversations.syncGroups()
//   const boGroup = await boClient.conversations.findGroup(alixGroup.id)

//   start = Date.now()
//   await boGroup!!.sync()
//   end = Date.now()
//   console.log(`Bo synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await boGroup!!.messages()
//   end = Date.now()
//   //20
//   console.log(`Bo loaded ${messages.length} messages in ${end - start}ms`)

//   const alixClient1 = await Client.create(alixSigner, {
//     env: 'local',
//     enableV3: true,
//     dbEncryptionKey: keyBytes,
//   })

//   const boClient1 = await Client.create(boSigner, {
//     env: 'local',
//     enableV3: true,
//     dbEncryptionKey: keyBytes,
//   })

//   const alixGroup1 = await alixClient1.conversations.findGroup(alixGroup.id)
//   await createMessages(alixGroup1!!, 5)
//   const boGroup1 = await boClient1.conversations.findGroup(alixGroup.id)
//   await createMessages(boGroup1!!, 5)

//   const alixClient2 = await Client.create(alixSigner, {
//     env: 'local',
//     enableV3: true,
//     dbEncryptionKey: keyBytes,
//   })

//   const boClient2 = await Client.create(boSigner, {
//     env: 'local',
//     enableV3: true,
//     dbEncryptionKey: keyBytes,
//   })

//   const alixGroup2 = await alixClient2.conversations.findGroup(alixGroup.id)
//   await createMessages(alixGroup2!!, 5)
//   const boGroup2 = await boClient2.conversations.findGroup(alixGroup.id)
//   await createMessages(boGroup2!!, 5)
//   const alixClient3 = await Client.create(alixSigner, {
//     env: 'local',
//     enableV3: true,
//     dbEncryptionKey: keyBytes,
//   })

//   const boClient3 = await Client.create(boSigner, {
//     env: 'local',
//     enableV3: true,
//     dbEncryptionKey: keyBytes,
//   })
//   const alixGroup3 = await alixClient3.conversations.findGroup(alixGroup.id)
//   await createMessages(alixGroup3!!, 5)
//   const boGroup3 = await boClient3.conversations.findGroup(alixGroup.id)
//   await createMessages(boGroup3!!, 5)

//   await createMessages(alixGroup!!, 5)
//   await createMessages(alixGroup3!!, 5)
//   await createMessages(alixGroup1!!, 5)
//   await createMessages(alixGroup2!!, 5)

//   await createMessages(boGroup!!, 5)
//   await createMessages(boGroup3!!, 5)
//   await createMessages(boGroup1!!, 5)
//   await createMessages(boGroup2!!, 5)
//   //106

//   const alixClient4 = await Client.create(alixSigner, {
//     env: 'local',
//     enableV3: true,
//     dbEncryptionKey: keyBytes,
//   })

//   const boClient4 = await Client.create(boSigner, {
//     env: 'local',
//     enableV3: true,
//     dbEncryptionKey: keyBytes,
//   })
//   const alixGroup4 = await alixClient4.conversations.findGroup(alixGroup.id)
//   const boGroup4 = await boClient4.conversations.findGroup(alixGroup.id)

//   start = Date.now()
//   await caroGroup!!.sync()
//   end = Date.now()
//   console.log(`Caro synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await caroGroup!!.messages()
//   end = Date.now()
//   //106
//   console.log(`Caro loaded ${messages.length} messages in ${end - start}ms`)

//   start = Date.now()
//   await alixGroup4!!.sync()
//   end = Date.now()
//   console.log(`Alix4 synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await alixGroup4!!.messages()
//   end = Date.now()
//   //107
//   console.log(`Alix4 loaded ${messages.length} messages in ${end - start}ms`)

//   start = Date.now()
//   await alixGroup.sync()
//   end = Date.now()
//   console.log(`Alix synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await alixGroup.messages()
//   end = Date.now()
//   //107
//   console.log(`Alix loaded ${messages.length} messages in ${end - start}ms`)

//   start = Date.now()
//   await boGroup!!.sync()
//   end = Date.now()
//   //80
//   console.log(`Bo synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await boGroup!!.messages()
//   end = Date.now()
//   console.log(`Bo loaded ${messages.length} messages in ${end - start}ms`)

//   start = Date.now()
//   await boGroup3!!.sync()
//   end = Date.now()
//   console.log(`Bo3 synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await boGroup3!!.messages()
//   end = Date.now()
//   //80
//   console.log(`Bo3 loaded ${messages.length} messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await boGroup2!!.messages()
//   end = Date.now()
//   //80
//   console.log(`Bo2 loaded ${messages.length} messages in ${end - start}ms`)

//   start = Date.now()
//   await frankieGroup!!.sync()
//   end = Date.now()
//   console.log(`Frankie synced messages in ${end - start}ms`)

//   start = Date.now()
//   messages = await frankieGroup!!.messages()
//   end = Date.now()
//   //106
//   console.log(`Frankie loaded ${messages.length} messages in ${end - start}ms`)

//   return true
// })

test('testing min repro of messages getting lost', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  if (!Config.TEST_V3_PRIVATE_KEY) {
    throw new Error('Add V3 private key to .env file')
  }
  const alixPrivateKeyHex: `0x${string}` = `0x${Config.TEST_V3_PRIVATE_KEY}`

  const alixSigner = convertPrivateKeyAccountToSigner(
    privateKeyToAccount(alixPrivateKeyHex)
  )

  const boPrivateKeyHex: `0x${string}` = `0x${Config.TEST_PRIVATE_KEY}`
  const boSigner = convertPrivateKeyAccountToSigner(
    privateKeyToAccount(boPrivateKeyHex)
  )
  const alixClient = await Client.create(alixSigner, {
    env: 'local',
    enableV3: true,
    dbEncryptionKey: keyBytes,
  })

  const boClient = await Client.create(boSigner, {
    env: 'local',
    enableV3: true,
    dbEncryptionKey: keyBytes,
  })

  const peers = await createClients(10)
  const caroClient = peers[1]
  const davonClient = peers[2]
  const eriClient = peers[3]
  const frankieClient = peers[4]

  const [alixGroup] = await createGroups(alixClient, peers, 1, 10)

  let start = Date.now()
  let messages = await alixGroup.messages()
  let end = Date.now()
  //11
  console.log(
    `Alix loaded ${messages.length} messages in ${end - start}ms (should have been 11)`
  )

  await caroClient.conversations.syncGroups()
  await davonClient.conversations.syncGroups()
  await eriClient.conversations.syncGroups()
  await frankieClient.conversations.syncGroups()

  const caroGroup = await caroClient.conversations.findGroup(alixGroup.id)
  const davonGroup = await davonClient.conversations.findGroup(alixGroup.id)
  const eriGroup = await eriClient.conversations.findGroup(alixGroup.id)
  const frankieGroup = await frankieClient.conversations.findGroup(alixGroup.id)

  start = Date.now()
  await caroGroup!!.sync()
  end = Date.now()
  console.log(`Caro synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await caroGroup!!.messages()
  end = Date.now()
  //10
  console.log(
    `Caro loaded ${messages.length} messages in ${end - start}ms (should have been 10)`
  )

  await createMessages(davonGroup!!, 5)
  await alixGroup.addMembers([boClient.address])
  await createMessages(frankieGroup!!, 5)
  await createMessages(alixGroup!!, 5)
  await createMessages(caroGroup!!, 5)
  await createMessages(eriGroup!!, 5)

  await boClient.conversations.syncGroups()
  const boGroup = await boClient.conversations.findGroup(alixGroup.id)

  start = Date.now()
  await boGroup!!.sync()
  end = Date.now()
  console.log(`Bo synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await boGroup!!.messages()
  end = Date.now()
  //20
  console.log(
    `Bo loaded ${messages.length} messages in ${end - start}ms (should have been 20)`
  )

  start = Date.now()
  messages = await eriGroup!!.messages()
  end = Date.now()
  //36
  console.log(
    `Eri loaded ${messages.length} messages in ${end - start}ms (should have been 36)`
  )

  start = Date.now()
  await alixGroup!!.sync()
  end = Date.now()
  console.log(`Alix synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await alixGroup!!.messages()
  end = Date.now()
  //37
  console.log(
    `Alix loaded ${messages.length} messages in ${end - start}ms (should have been 37)`
  )

  start = Date.now()
  await boGroup!!.sync()
  end = Date.now()
  console.log(`Bo synced messages in ${end - start}ms`)

  start = Date.now()
  messages = await boGroup!!.messages()
  end = Date.now()
  //20
  console.log(
    `Bo loaded ${messages.length} messages in ${end - start}ms (should have been 20)`
  )
  
  await createMessages(frankieGroup!!, 5)
  await createMessages(boGroup!!, 5)
  start = Date.now()
  messages = await boGroup!!.messages()
  end = Date.now()
  //30
  console.log(
    `Bo loaded ${messages.length} messages in ${end - start}ms (should have been 30)`
  )

  return true
})
