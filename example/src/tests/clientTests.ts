import { Wallet } from 'ethers'
import RNFS from 'react-native-fs'

import { Test, assert, createClients, delayToPropogate } from './test-utils'
import { Client, Group } from '../../../src/index'
import { DefaultContentTypes } from 'xmtp-react-native-sdk/lib/types/DefaultContentType'

export const clientTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  clientTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('groups cannot fork', async () => {
  const [alix, bo, caro] = await createClients(3)
  // Create group with 3 users
  const { id: groupId } = await alix.conversations.newGroup([
    bo.address,
    caro.address,
  ])

  const getGroupForClient = async (client: Client) => {
    // Always sync the client before getting the group
    await client.conversations.sync()
    const group = await client.conversations.findGroup(groupId)
    assert(group !== undefined, `Group not found for ${client.address}`)
    return group as Group<DefaultContentTypes>
  }

  const syncClientAndGroup = async (client: Client) => {
    const group = await getGroupForClient(client)
    await group.sync()
  }

  const addMemberToGroup = async (fromClient: Client, addresses: string[]) => {
    await syncClientAndGroup(fromClient)
    const group = await getGroupForClient(fromClient)
    await group.addMembers(addresses)
    await delayToPropogate(500)
  }

  const removeMemberFromGroup = async (
    fromClient: Client,
    addresses: string[]
  ) => {
    await syncClientAndGroup(fromClient)
    const group = await getGroupForClient(fromClient)
    await group.removeMembers(addresses)
    await delayToPropogate(500)
  }

  // Helper to send a message from a bunch of senders and make sure it is received by all receivers
  const testMessageSending = async (senderClient: Client, receiver: Client) => {
    // for (const senderClient of senders) {
    const messageContent = Math.random().toString(36)
    await syncClientAndGroup(senderClient)
    const senderGroup = await getGroupForClient(senderClient)
    await senderGroup.send(messageContent)

    await delayToPropogate(500)
    await senderGroup.sync()

    await syncClientAndGroup(receiver)

    const receiverGroupToCheck = await getGroupForClient(receiver)
    await receiverGroupToCheck.sync()

    const messages = await receiverGroupToCheck.messages({
      direction: 'DESCENDING',
    })
    const lastMessage = messages[0]
    // console.log(lastMessage);
    console.log(
      `${receiverGroupToCheck.client.address} sees ${messages.length} messages in group`
    )
    assert(
      lastMessage !== undefined &&
        lastMessage.nativeContent.text === messageContent,
      `${receiverGroupToCheck.client.address} should have received the message, FORK? ${lastMessage?.nativeContent.text} !== ${messageContent}`
    )
    // }
  }

  console.log('Testing that messages sent by alix are received by bo')
  await testMessageSending(alix, bo)
  console.log('Alix & Bo are not forked at the beginning')

  // Test adding members one by one
  // console.log('Testing adding members one by one...')
  const newClients = await createClients(2)

  // Add back several members
  console.log('Adding new members to the group...')
  for (const client of newClients) {
    console.log(`Adding member ${client.address}...`)
    await addMemberToGroup(alix, [client.address])
  }
  await delayToPropogate()

  await alix.conversations.sync()
  await syncClientAndGroup(alix)

  // NB => if we don't use Promise.all but a loop, we don't get a fork
  const REMOVE_MEMBERS_IN_PARALLEL = true
  if (REMOVE_MEMBERS_IN_PARALLEL) {
    console.log('Removing members in parallel')

    await Promise.all(
      newClients.map((client) => {
        console.log(`Removing member ${client.address}...`)
        return removeMemberFromGroup(alix, [client.address])
      })
    )
  } else {
    console.log('Removing members one by one')

    for (const client of newClients) {
      console.log(`Removing member ${client.address}...`)
      await removeMemberFromGroup(alix, [client.address])
    }
  }

  await delayToPropogate(1000)

  // When forked, it stays forked even if we try 5 times
  // but sometimes it is not forked and works 5/5 times
  let forkCount = 0
  const tryCount = 5
  for (let i = 0; i < tryCount; i++) {
    console.log(`Checking fork status ${i+1}/${tryCount}`)
    try {
      await syncClientAndGroup(alix)
      await syncClientAndGroup(bo)
      await delayToPropogate(500)
      await testMessageSending(alix, bo)
      console.log('Not forked!')
    } catch (e: any) {
      console.log('Forked!')
      console.log(e)
      forkCount++
    }
  }

  assert(forkCount === 0, `Forked ${forkCount}/${tryCount} times`)

  return true
})

test('groups cannot fork short version', async () => {
  const [alix, bo, new_one, new_two] = await createClients(4)
  // Create group with 2 users
  const alixGroup = await alix.conversations.newGroup([
    bo.address,
    new_one.address,
    new_two.address,
  ])

  // sync clients
  await alix.conversations.sync()
  await bo.conversations.sync()
  const boGroup: Group<DefaultContentTypes> = (await bo.conversations.findGroup(alixGroup.id))!

  // Remove two members in parallel
  // NB => if we don't use Promise.all but a loop, we don't get a fork
  console.log('*************libxmtp*********************: Removing members in parallel')
  await Promise.all([
    alixGroup.removeMembers([new_one.address]),
    alixGroup.removeMembers([new_two.address])
  ])

  // Helper to send a message from a bunch of senders and make sure it is received by all receivers
  const testMessageSending = async (senderGroup: Group<DefaultContentTypes>, receiverGroup: Group<DefaultContentTypes>) => {
    const messageContent = Math.random().toString(36)
    await senderGroup.sync()
    await alixGroup.send(messageContent)

    await delayToPropogate(500)
    await alixGroup.sync()
    await receiverGroup.sync()

    const messages = await receiverGroup.messages({
      direction: 'DESCENDING',
    })
    const lastMessage = messages[0]
    console.log(
      `${receiverGroup.client.address} sees ${messages.length} messages in group`
    )
    assert(
      lastMessage !== undefined &&
        lastMessage.nativeContent.text === messageContent,
      `${receiverGroup.client.address} should have received the message, FORK? ${lastMessage?.nativeContent.text} !== ${messageContent}`
    )
  }
  // When forked, it stays forked even if we try 5 times
  // but sometimes it is not forked and works 5/5 times
  let forkCount = 0
  const tryCount = 5
  for (let i = 0; i < tryCount; i++) {
    console.log(`Checking fork status ${i+1}/${tryCount}`)
    try {
      await alixGroup.sync()
      await boGroup.sync()
      await delayToPropogate(500)
      await testMessageSending(alixGroup, boGroup)
      console.log('Not forked!')
    } catch (e: any) {
      console.log('Forked!')
      console.log(e)
      forkCount++
    }
  }
  assert(forkCount === 0, `Forked ${forkCount}/${tryCount} times`)

  return true
})

test('groups cannot fork short version - add members', async () => {
  const [alix, bo, new_one, new_two, new_three, new_four] = await createClients(6)
  // Create group with 2 users
  const alixGroup = await alix.conversations.newGroup([
    bo.address,
    new_one.address,
    new_two.address,
  ])

  // sync clients
  await alix.conversations.sync()
  await bo.conversations.sync()
  const boGroup: Group<DefaultContentTypes> = (await bo.conversations.findGroup(alixGroup.id))!

  // Remove two members in parallel
  // NB => if we don't use Promise.all but a loop, we don't get a fork
  console.log('*************libxmtp*********************: Adding members in parallel')
  await Promise.all([
    alixGroup.addMembers([new_three.address]),
    alixGroup.addMembers([new_four.address])
  ])

  // Helper to send a message from a bunch of senders and make sure it is received by all receivers
  const testMessageSending = async (senderGroup: Group<DefaultContentTypes>, receiverGroup: Group<DefaultContentTypes>) => {
    const messageContent = Math.random().toString(36)
    await senderGroup.sync()
    await alixGroup.send(messageContent)

    await delayToPropogate(500)
    await alixGroup.sync()
    await receiverGroup.sync()

    const messages = await receiverGroup.messages({
      direction: 'DESCENDING',
    })
    const lastMessage = messages[0]
    console.log(
      `${receiverGroup.client.address} sees ${messages.length} messages in group`
    )
    assert(
      lastMessage !== undefined &&
        lastMessage.nativeContent.text === messageContent,
      `${receiverGroup.client.address} should have received the message, FORK? ${lastMessage?.nativeContent.text} !== ${messageContent}`
    )
  }
  // When forked, it stays forked even if we try 5 times
  // but sometimes it is not forked and works 5/5 times
  let forkCount = 0
  const tryCount = 5
  for (let i = 0; i < tryCount; i++) {
    console.log(`Checking fork status ${i+1}/${tryCount}`)
    try {
      await alixGroup.sync()
      await boGroup.sync()
      await delayToPropogate(500)
      await testMessageSending(alixGroup, boGroup)
      console.log('Not forked!')
    } catch (e: any) {
      console.log('Forked!')
      console.log(e)
      forkCount++
    }
  }
  assert(forkCount === 0, `Forked ${forkCount}/${tryCount} times`)

  return true
})

test('groups cannot fork short version - update metadata', async () => {
  const [alix, bo, new_one, new_two, new_three, new_four] = await createClients(6)
  // Create group with 2 users
  const alixGroup = await alix.conversations.newGroup([
    bo.address,
    new_one.address,
    new_two.address,
  ])

  // sync clients
  await alix.conversations.sync()
  await bo.conversations.sync()
  const boGroup: Group<DefaultContentTypes> = (await bo.conversations.findGroup(alixGroup.id))!

  // Remove two members in parallel
  // NB => if we don't use Promise.all but a loop, we don't get a fork
  console.log('*************libxmtp*********************: Updating metadata in parallel')
  await Promise.all([
    alixGroup.updateGroupName('new name'),
    alixGroup.updateGroupName('new name 2')
  ])

  // Helper to send a message from a bunch of senders and make sure it is received by all receivers
  const testMessageSending = async (senderGroup: Group<DefaultContentTypes>, receiverGroup: Group<DefaultContentTypes>) => {
    const messageContent = Math.random().toString(36)
    await senderGroup.sync()
    await alixGroup.send(messageContent)

    await delayToPropogate(500)
    await alixGroup.sync()
    await receiverGroup.sync()

    const messages = await receiverGroup.messages({
      direction: 'DESCENDING',
    })
    const lastMessage = messages[0]
    console.log(
      `${receiverGroup.client.address} sees ${messages.length} messages in group`
    )
    assert(
      lastMessage !== undefined &&
        lastMessage.nativeContent.text === messageContent,
      `${receiverGroup.client.address} should have received the message, FORK? ${lastMessage?.nativeContent.text} !== ${messageContent}`
    )
  }
  // When forked, it stays forked even if we try 5 times
  // but sometimes it is not forked and works 5/5 times
  let forkCount = 0
  const tryCount = 5
  for (let i = 0; i < tryCount; i++) {
    console.log(`Checking fork status ${i+1}/${tryCount}`)
    try {
      await alixGroup.sync()
      await boGroup.sync()
      await delayToPropogate(500)
      await testMessageSending(alixGroup, boGroup)
      console.log('Not forked!')
    } catch (e: any) {
      console.log('Forked!')
      console.log(e)
      forkCount++
    }
  }
  assert(forkCount === 0, `Forked ${forkCount}/${tryCount} times`)

  return true
})

// test('can make a client', async () => {
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   const keyBytes = new Uint8Array([
//     233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
//     166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
//   ])
//   const client = await Client.createRandom({
//     env: 'local',
//     appVersion: 'Testing/0.0.0',
//     dbEncryptionKey: keyBytes,
//   })

//   const inboxId = await Client.getOrCreateInboxId(client.address, 'local')

//   assert(
//     client.inboxId === inboxId,
//     `inboxIds should match but were ${client.inboxId} and ${inboxId}`
//   )
//   return true
// })

// test('static can message', async () => {
//   const [alix, bo] = await createClients(2)

//   const addressMap = await Client.canMessage('local', [
//     alix.address,
//     '0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67',
//     bo.address,
//   ])

//   assert(
//     addressMap[
//       '0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67'.toLocaleLowerCase()
//     ] === false,
//     `should not be able to message 0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67`
//   )

//   assert(
//     addressMap[alix.address.toLowerCase()] === true,
//     `should be able to message ${alix.address}`
//   )

//   assert(
//     addressMap[bo.address.toLowerCase()] === true,
//     `should be able to message ${bo.address}`
//   )
//   return true
// })

// test('can revoke all other installations', async () => {
//   const keyBytes = new Uint8Array([
//     233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
//     166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
//   ])
//   const alixWallet = Wallet.createRandom()

//   // create a v3 client
//   const alix = await Client.create(alixWallet, {
//     env: 'local',
//     appVersion: 'Testing/0.0.0',
//     dbEncryptionKey: keyBytes,
//   })

//   await alix.deleteLocalDatabase()

//   const alix2 = await Client.create(alixWallet, {
//     env: 'local',
//     appVersion: 'Testing/0.0.0',
//     dbEncryptionKey: keyBytes,
//   })

//   await Client.build(alix2.address, {
//     env: 'local',
//     appVersion: 'Testing/0.0.0',
//     dbEncryptionKey: keyBytes,
//   })

//   await alix2.deleteLocalDatabase()

//   const alix3 = await Client.create(alixWallet, {
//     env: 'local',
//     appVersion: 'Testing/0.0.0',
//     dbEncryptionKey: keyBytes,
//   })

//   const inboxState2 = await alix3.inboxState(true)
//   assert(
//     inboxState2.installations.length === 3,
//     `installations length should be 3 but was ${inboxState2.installations.length}`
//   )

//   await alix3.revokeAllOtherInstallations(alixWallet)

//   const inboxState3 = await alix3.inboxState(true)
//   assert(
//     inboxState3.installations.length === 1,
//     `installations length should be 1 but was ${inboxState3.installations.length}`
//   )

//   assert(
//     inboxState3.installations[0].createdAt !== undefined,
//     `installations createdAt should not be undefined`
//   )
//   return true
// })

// test('calls preAuthenticateToInboxCallback when supplied', async () => {
//   let isCallbackCalled = 0
//   let isPreAuthCalled = false
//   const preAuthenticateToInboxCallback = () => {
//     isCallbackCalled++
//     isPreAuthCalled = true
//   }

//   const keyBytes = new Uint8Array([
//     233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
//     166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
//   ])

//   await Client.createRandom({
//     env: 'local',
//     preAuthenticateToInboxCallback,
//     dbEncryptionKey: keyBytes,
//   })

//   assert(
//     isCallbackCalled === 1,
//     `callback should be called 1 times but was ${isCallbackCalled}`
//   )

//   if (!isPreAuthCalled) {
//     throw new Error('preAuthenticateToInboxCallback not called')
//   }

//   return true
// })

// test('can delete a local database', async () => {
//   let [client, anotherClient] = await createClients(2)

//   await client.conversations.newGroup([anotherClient.address])
//   await client.conversations.sync()
//   assert(
//     (await client.conversations.listGroups()).length === 1,
//     `should have a group size of 1 but was ${
//       (await client.conversations.listGroups()).length
//     }`
//   )

//   assert(
//     client.dbPath !== '',
//     `client dbPath should be set but was ${client.dbPath}`
//   )
//   await client.deleteLocalDatabase()
//   client = await Client.createRandom({
//     env: 'local',
//     appVersion: 'Testing/0.0.0',
//     dbEncryptionKey: new Uint8Array([
//       233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
//       166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135,
//       145,
//     ]),
//   })
//   await client.conversations.sync()
//   assert(
//     (await client.conversations.listGroups()).length === 0,
//     `should have a group size of 0 but was ${
//       (await client.conversations.listGroups()).length
//     }`
//   )

//   return true
// })

// test('can make a client with encryption key and database directory', async () => {
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   const dbDirPath = `${RNFS.DocumentDirectoryPath}/xmtp_db`
//   const directoryExists = await RNFS.exists(dbDirPath)
//   if (!directoryExists) {
//     await RNFS.mkdir(dbDirPath)
//   }
//   const key = new Uint8Array([
//     233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
//     166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
//   ])

//   const client = await Client.createRandom({
//     env: 'local',
//     appVersion: 'Testing/0.0.0',
//     dbEncryptionKey: key,
//     dbDirectory: dbDirPath,
//   })

//   const anotherClient = await Client.createRandom({
//     env: 'local',
//     appVersion: 'Testing/0.0.0',
//     dbEncryptionKey: key,
//   })

//   await client.conversations.newGroup([anotherClient.address])
//   assert(
//     (await client.conversations.listGroups()).length === 1,
//     `should have a group size of 1 but was ${
//       (await client.conversations.listGroups()).length
//     }`
//   )

//   const clientFromBundle = await Client.build(client.address, {
//     env: 'local',
//     appVersion: 'Testing/0.0.0',
//     dbEncryptionKey: key,
//     dbDirectory: dbDirPath,
//   })

//   assert(
//     clientFromBundle.address === client.address,
//     `clients dont match ${client.address} and ${clientFromBundle.address}`
//   )

//   assert(
//     (await clientFromBundle.conversations.listGroups()).length === 1,
//     `should have a group size of 1 but was ${
//       (await clientFromBundle.conversations.listGroups()).length
//     }`
//   )
//   return true
// })

// test('can drop a local database', async () => {
//   const [client, anotherClient] = await createClients(2)

//   const group = await client.conversations.newGroup([anotherClient.address])
//   await client.conversations.sync()
//   assert(
//     (await client.conversations.listGroups()).length === 1,
//     `should have a group size of 1 but was ${
//       (await client.conversations.listGroups()).length
//     }`
//   )

//   await client.dropLocalDatabaseConnection()

//   try {
//     await group.send('hi')
//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   } catch (error) {
//     await client.reconnectLocalDatabase()
//     await group.send('hi')
//     return true
//   }
//   throw new Error('should throw when local database not connected')
// })

// test('can drop client from memory', async () => {
//   const [client, anotherClient] = await createClients(2)
//   await client.dropLocalDatabaseConnection()
//   await anotherClient.dropLocalDatabaseConnection()

//   await client.reconnectLocalDatabase()
//   await Client.dropClient(anotherClient.installationId)
//   try {
//     await anotherClient.reconnectLocalDatabase()
//     return false
//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   } catch (error) {
//     // We cannot reconnect anotherClient because it was successfully dropped
//     return true
//   }
// })

// test('can get a inboxId from an address', async () => {
//   const [alix, bo] = await createClients(2)

//   const boInboxId = await alix.findInboxIdFromAddress(bo.address)
//   assert(boInboxId === bo.inboxId, `${boInboxId} should match ${bo.inboxId}`)
//   return true
// })

// test('production client creation does not error', async () => {
//   const key = new Uint8Array([
//     233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
//     166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
//   ])

//   try {
//     await Client.createRandom({
//       env: 'production',
//       appVersion: 'Testing/0.0.0',
//       dbEncryptionKey: key,
//     })
//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   } catch (error) {
//     throw error
//   }
//   return true
// })

// test('can find others inbox states', async () => {
//   const [alix, bo, caro] = await createClients(3)

//   const states = await alix.inboxStates(true, [bo.inboxId, caro.inboxId])
//   assert(
//     states[0].recoveryAddress.toLowerCase === bo.address.toLowerCase,
//     `addresses dont match ${states[0].recoveryAddress} and ${bo.address}`
//   )
//   assert(
//     states[1].addresses[0].toLowerCase === caro.address.toLowerCase,
//     `clients dont match ${states[1].addresses[0]} and ${caro.address}`
//   )

//   return true
// })

// test('can verify signatures', async () => {
//   const [alix, bo] = await createClients(2)
//   const signature = await alix.signWithInstallationKey('a message')

//   assert(
//     (await alix.verifySignature('a message', signature)) === true,
//     `message should verify`
//   )

//   assert(
//     (await alix.verifySignature('bad string', signature)) === false,
//     `message should not verify for bad string`
//   )

//   assert(
//     (await bo.verifySignature('a message', signature)) === false,
//     `message should not verify for bo`
//   )

//   return true
// })

// test('can add and remove accounts', async () => {
//   const keyBytes = new Uint8Array([
//     233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
//     166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
//   ])

//   const alixWallet = Wallet.createRandom()
//   const alixWallet2 = Wallet.createRandom()
//   const alixWallet3 = Wallet.createRandom()

//   const alix = await Client.create(alixWallet, {
//     env: 'local',
//     appVersion: 'Testing/0.0.0',
//     dbEncryptionKey: keyBytes,
//   })

//   await alix.addAccount(alixWallet2)
//   await alix.addAccount(alixWallet3)

//   const inboxState = await alix.inboxState(true)
//   assert(
//     inboxState.addresses.length === 3,
//     `addresses length should be 3 but was ${inboxState.addresses.length}`
//   )
//   assert(
//     inboxState.installations.length === 1,
//     `addresses length should be 1 but was ${inboxState.installations.length}`
//   )
//   assert(
//     inboxState.recoveryAddress === alix.address.toLowerCase(),
//     `recovery address should be ${alix.address} but was ${inboxState.recoveryAddress}`
//   )

//   await alix.removeAccount(alixWallet, await alixWallet3.getAddress())
//   const inboxState2 = await alix.inboxState(true)
//   assert(
//     inboxState2.addresses.length === 2,
//     `addresses length should be 2 but was ${inboxState.addresses.length}`
//   )

//   return true
// })
