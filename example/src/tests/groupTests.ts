import { Wallet } from 'ethers'
import { Platform } from 'expo-modules-core'
import RNFS from 'react-native-fs'
import { DecodedMessage } from 'xmtp-react-native-sdk/lib/DecodedMessage'

import {
  Test,
  assert,
  createClients,
  createGroups,
  delayToPropogate,
} from './test-utils'
import {
  Client,
  Conversation,
  Group,
  ConversationContainer,
  ConversationVersion,
  MessageDeliveryStatus,
  GroupUpdatedContent,
  GroupUpdatedCodec,
} from '../../../src/index'

export const groupTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  groupTests.push({ name: String(counter++) + '. ' + name, run: perform })
}

test('can make a MLS V3 client', async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const client = await Client.createRandom({
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
  return true
})

test('can revoke all other installations', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const alixWallet = Wallet.createRandom()

  const alix = await Client.create(alixWallet, {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: keyBytes,
  })
  await alix.deleteLocalDatabase()

  const alix2 = await Client.create(alixWallet, {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: keyBytes,
  })

  const inboxState = await alix2.inboxState(true)
  assert(
    inboxState.installations.length === 2,
    `installations length should be 2 but was ${inboxState.installations.length}`
  )

  await alix2.revokeAllOtherInstallations(alixWallet)

  const inboxState2 = await alix2.inboxState(true)
  assert(
    inboxState2.installations.length === 1,
    `installations length should be 1 but was ${inboxState2.installations.length}`
  )

  assert(
    inboxState2.installations[0].createdAt !== undefined,
    `installations createdAt should not be undefined`
  )
  return true
})

test('calls preAuthenticateToInboxCallback when supplied', async () => {
  let isCallbackCalled = 0
  let isPreAuthCalled = false
  const preAuthenticateToInboxCallback = () => {
    isCallbackCalled++
    isPreAuthCalled = true
  }
  const preEnableIdentityCallback = () => {
    isCallbackCalled++
  }
  const preCreateIdentityCallback = () => {
    isCallbackCalled++
  }
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  await Client.createRandom({
    env: 'local',
    enableV3: true,
    preEnableIdentityCallback,
    preCreateIdentityCallback,
    preAuthenticateToInboxCallback,
    dbEncryptionKey: keyBytes,
  })

  assert(
    isCallbackCalled === 3,
    `callback should be called 3 times but was ${isCallbackCalled}`
  )

  if (!isPreAuthCalled) {
    throw new Error('preAuthenticateToInboxCallback not called')
  }

  return true
})

test('can delete a local database', async () => {
  let [client, anotherClient] = await createClients(2)

  await client.conversations.newGroup([anotherClient.address])
  await client.conversations.syncGroups()
  assert(
    (await client.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await client.conversations.listGroups()).length
    }`
  )

  assert(
    client.dbPath !== '',
    `client dbPath should be set but was ${client.dbPath}`
  )
  await client.deleteLocalDatabase()
  client = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: new Uint8Array([
      233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
      166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135,
      145,
    ]),
  })
  await client.conversations.syncGroups()
  assert(
    (await client.conversations.listGroups()).length === 0,
    `should have a group size of 0 but was ${
      (await client.conversations.listGroups()).length
    }`
  )

  return true
})

test('can make a MLS V3 client with encryption key and database directory', async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dbDirPath = `${RNFS.DocumentDirectoryPath}/xmtp_db`
  const directoryExists = await RNFS.exists(dbDirPath)
  if (!directoryExists) {
    await RNFS.mkdir(dbDirPath)
  }
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  const client = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: key,
    dbDirectory: dbDirPath,
  })

  const anotherClient = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: key,
  })

  await client.conversations.newGroup([anotherClient.address])
  assert(
    (await client.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await client.conversations.listGroups()).length
    }`
  )

  const bundle = await client.exportKeyBundle()
  const clientFromBundle = await Client.createFromKeyBundle(bundle, {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: key,
    dbDirectory: dbDirPath,
  })

  assert(
    clientFromBundle.address === client.address,
    `clients dont match ${client.address} and ${clientFromBundle.address}`
  )

  assert(
    (await clientFromBundle.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await clientFromBundle.conversations.listGroups()).length
    }`
  )
  return true
})

test('can drop a local database', async () => {
  const [client, anotherClient] = await createClients(2)

  const group = await client.conversations.newGroup([anotherClient.address])
  await client.conversations.syncGroups()
  assert(
    (await client.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await client.conversations.listGroups()).length
    }`
  )

  await client.dropLocalDatabaseConnection()

  try {
    await group.send('hi')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    await client.reconnectLocalDatabase()
    await group.send('hi')
    return true
  }
  throw new Error('should throw when local database not connected')
})

test('can drop client from memory', async () => {
  const [client, anotherClient] = await createClients(2)
  await client.dropLocalDatabaseConnection()
  await anotherClient.dropLocalDatabaseConnection()

  await client.reconnectLocalDatabase()
  await Client.dropClient(anotherClient.inboxId)
  try {
    await anotherClient.reconnectLocalDatabase()
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // We cannot reconnect anotherClient because it was successfully dropped
    return true
  }
})

test('can get a inboxId from an address', async () => {
  const [alix, bo] = await createClients(2)

  const boInboxId = await alix.findInboxIdFromAddress(bo.address)
  assert(boInboxId === bo.inboxId, `${boInboxId} should match ${bo.inboxId}`)
  return true
})

test('can make a MLS V3 client from bundle', async () => {
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  const client = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: key,
  })

  const anotherClient = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: key,
  })

  const group1 = await client.conversations.newGroup([anotherClient.address])

  assert(
    group1.client.address === client.address,
    `clients dont match ${client.address} and ${group1.client.address}`
  )

  const bundle = await client.exportKeyBundle()
  const client2 = await Client.createFromKeyBundle(bundle, {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: key,
  })

  assert(
    client.address === client2.address,
    `clients dont match ${client2.address} and ${client.address}`
  )

  assert(
    client.inboxId === client2.inboxId,
    `clients dont match ${client2.inboxId} and ${client.inboxId}`
  )

  assert(
    client.installationId === client2.installationId,
    `clients dont match ${client2.installationId} and ${client.installationId}`
  )

  const randomClient = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: key,
  })

  const group = await client2.conversations.newGroup([randomClient.address])

  assert(
    group.client.address === client2.address,
    `clients dont match ${client2.address} and ${group.client.address}`
  )

  return true
})

test('production MLS V3 client creation does not error', async () => {
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  try {
    await Client.createRandom({
      env: 'production',
      appVersion: 'Testing/0.0.0',
      enableV3: true,
      dbEncryptionKey: key,
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    throw error
  }
  return true
})

test('can cancel streams', async () => {
  const [alix, bo] = await createClients(2)
  let messageCallbacks = 0

  await bo.conversations.streamAllMessages(async () => {
    messageCallbacks++
  }, true)

  const group = await alix.conversations.newGroup([bo.address])
  await group.send('hello')
  await delayToPropogate()

  assert(
    messageCallbacks === 1,
    'message stream should have received 1 message'
  )

  await bo.conversations.cancelStreamAllMessages()
  await delayToPropogate()

  await group.send('hello')
  await group.send('hello')
  await group.send('hello')

  await delayToPropogate()

  assert(
    messageCallbacks === 1,
    'message stream should still only received 1 message'
  )

  await bo.conversations.streamAllMessages(async () => {
    messageCallbacks++
  }, true)

  await delayToPropogate()

  await group.send('hello')
  await delayToPropogate()

  assert(
    messageCallbacks === 2,
    'message stream should have received 2 message'
  )

  return true
})

test('group message delivery status', async () => {
  const [alixClient, boClient] = await createClients(2)
  const alixGroup = await alixClient.conversations.newGroup([boClient.address])

  await alixGroup.send('hello, world')

  const alixMessages: DecodedMessage[] = await alixGroup.messages()

  assert(
    alixMessages.length === 2,
    `the messages length should be 2 but was ${alixMessages.length}`
  )

  const alixMessagesFiltered: DecodedMessage[] = await alixGroup.messages({
    deliveryStatus: MessageDeliveryStatus.PUBLISHED,
  })

  assert(
    alixMessagesFiltered.length === 2,
    `the messages length should be 2 but was ${alixMessagesFiltered.length}`
  )

  await alixGroup.sync()
  const alixMessages2: DecodedMessage[] = await alixGroup.messages()

  assert(
    alixMessages2.length === 2,
    `the messages length should be 2 but was ${alixMessages.length}`
  )

  assert(
    alixMessages2[0].deliveryStatus === 'PUBLISHED',
    `the message should have a delivery status of PUBLISHED but was ${alixMessages2[0].deliveryStatus}`
  )

  await boClient.conversations.syncGroups()
  const boGroup = (await boClient.conversations.listGroups())[0]
  await boGroup.sync()
  const boMessages: DecodedMessage[] = await boGroup.messages()

  assert(
    boMessages.length === 1,
    `the messages length should be 1 but was ${boMessages.length}`
  )

  assert(
    boMessages[0].deliveryStatus === 'PUBLISHED',
    `the message should have a delivery status of PUBLISHED but was ${boMessages[0].deliveryStatus}`
  )

  return true
})

test('can find a group by id', async () => {
  const [alixClient, boClient] = await createClients(2)
  const alixGroup = await alixClient.conversations.newGroup([boClient.address])

  await boClient.conversations.syncGroups()
  const boGroup = await boClient.conversations.findGroup(alixGroup.id)

  assert(
    boGroup?.id === alixGroup.id,
    `bo ${boGroup?.id} does not match alix ${alixGroup.id}`
  )
  return true
})

test('can find a message by id', async () => {
  const [alixClient, boClient] = await createClients(2)
  const alixGroup = await alixClient.conversations.newGroup([boClient.address])
  const alixMessageId = await alixGroup.send('Hello')

  await boClient.conversations.syncGroups()
  const boGroup = await boClient.conversations.findGroup(alixGroup.id)
  await boGroup?.sync()
  const boMessage = await boClient.conversations.findV3Message(alixMessageId)

  assert(
    boMessage?.id === alixMessageId,
    `bo message ${boMessage?.id} does not match ${alixMessageId}`
  )
  return true
})

test('who added me to a group', async () => {
  const [alixClient, boClient] = await createClients(2)
  await alixClient.conversations.newGroup([boClient.address])

  await boClient.conversations.syncGroups()
  const boGroup = (await boClient.conversations.listGroups())[0]
  const addedByInboxId = await boGroup.addedByInboxId

  assert(
    addedByInboxId === alixClient.inboxId,
    `addedByInboxId ${addedByInboxId} does not match ${alixClient.inboxId}`
  )
  return true
})

test('can get members of a group', async () => {
  const [alixClient, boClient] = await createClients(2)
  const group = await alixClient.conversations.newGroup([boClient.address])

  const members = group.members

  assert(members.length === 2, `Should be 2 members but was ${members.length}`)

  // We can not be sure of the order that members will be returned in
  for (const member of members) {
    // Alix created the group so they are a super admin
    if (
      member.addresses[0].toLocaleLowerCase() ===
      alixClient.address.toLocaleLowerCase()
    ) {
      assert(
        member.permissionLevel === 'super_admin',
        `Should be super_admin but was ${member.permissionLevel}`
      )
    }
    // Bo did not create the group so he defaults to permission level "member"
    if (
      member.addresses[0].toLocaleLowerCase() ===
      boClient.address.toLocaleLowerCase()
    ) {
      assert(
        member.permissionLevel === 'member',
        `Should be member but was ${member.permissionLevel}`
      )
    }
  }
  return true
})

test('can message in a group', async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3)

  // alix's num groups start at 0
  let alixGroups = await alixClient.conversations.listGroups()
  if (alixGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.address,
    caroClient.address,
  ])

  // alix's num groups == 1
  await alixClient.conversations.syncGroups()
  alixGroups = await alixClient.conversations.listGroups()
  if (alixGroups.length !== 1) {
    throw new Error('num groups should be 1')
  }

  // alix group should match create time from list function
  assert(alixGroups[0].createdAt === alixGroup.createdAt, 'group create time')

  // alix can confirm memberInboxIds
  await alixGroup.sync()
  const memberInboxIds = await alixGroup.memberInboxIds()
  if (memberInboxIds.length !== 3) {
    throw new Error('num group members should be 3')
  }

  if (
    !(
      memberInboxIds.includes(alixClient.inboxId) &&
      memberInboxIds.includes(boClient.inboxId) &&
      memberInboxIds.includes(caroClient.inboxId)
    )
  ) {
    throw new Error('missing address')
  }

  // alix can send messages
  await alixGroup.send('hello, world')
  await alixGroup.send('gm')

  // bo's num groups == 1
  await boClient.conversations.syncGroups()
  const boGroups = await boClient.conversations.listGroups()
  if (boGroups.length !== 1) {
    throw new Error(
      'num groups for bo should be 1, but it is' + boGroups.length
    )
  }
  await delayToPropogate()
  // bo can read messages from alix
  await boGroups[0].sync()
  const boMessages: DecodedMessage[] = await boGroups[0].messages()

  if (boMessages.length !== 2) {
    throw new Error(
      'num messages for bo should be 2, but it is' + boMessages.length
    )
  }
  if (boMessages[0].content() !== 'gm') {
    throw new Error("newest message should be 'gm'")
  }
  if (boMessages[1].content() !== 'hello, world') {
    throw new Error("newest message should be 'hello, world'")
  }
  // bo can send a message
  await boGroups[0].send('hey guys!')

  // caro's num groups == 1
  await caroClient.conversations.syncGroups()
  const caroGroups = await caroClient.conversations.listGroups()
  if (caroGroups.length !== 1) {
    throw new Error(
      'num groups for caro should be 1, but it is' + caroGroups.length
    )
  }

  // caro can read messages from alix and bo
  await caroGroups[0].sync()
  const caroMessages = await caroGroups[0].messages()

  if (caroMessages.length !== 3) {
    throw new Error(`length should be 3 but was ${caroMessages.length}`)
  }
  if (caroMessages[0].content() !== 'hey guys!') {
    throw new Error(
      `newest Message should be 'hey guys!' but was ${caroMessages[0].content()}`
    )
  }
  if (caroMessages[1].content() !== 'gm') {
    throw new Error(
      `second Message should be 'gm' but was ${caroMessages[1].content()}`
    )
  }

  return true
})

test('unpublished messages handling', async () => {
  // Initialize fixture clients
  const [alixClient, boClient] = await createClients(3)

  // Create a new group with Bob and Alice
  const boGroup = await boClient.conversations.newGroup([alixClient.address])

  // Sync Alice's client to get the new group
  await alixClient.conversations.syncGroups()
  const alixGroup = await alixClient.conversations.findGroup(boGroup.id)
  if (!alixGroup) {
    throw new Error(`Group not found for id: ${boGroup.id}`)
  }

  // Check if the group is allowed initially
  let isGroupAllowed = await alixClient.contacts.isGroupAllowed(boGroup.id)
  if (isGroupAllowed) {
    throw new Error('Group should not be allowed initially')
  }

  // Prepare a message in the group
  const preparedMessageId = await alixGroup.prepareMessage('Test text')

  // Check if the group is allowed after preparing the message
  isGroupAllowed = await alixClient.contacts.isGroupAllowed(boGroup.id)
  if (!isGroupAllowed) {
    throw new Error('Group should be allowed after preparing a message')
  }

  // Verify the message count in the group
  let messageCount = (await alixGroup.messages()).length
  if (messageCount !== 1) {
    throw new Error(`Message count should be 1, but it is ${messageCount}`)
  }

  // Verify the count of published and unpublished messages
  let messageCountPublished = (
    await alixGroup.messages({
      deliveryStatus: MessageDeliveryStatus.PUBLISHED,
    })
  ).length
  let messageCountUnpublished = (
    await alixGroup.messages({
      deliveryStatus: MessageDeliveryStatus.UNPUBLISHED,
    })
  ).length
  if (messageCountPublished !== 0) {
    throw new Error(
      `Published message count should be 0, but it is ${messageCountPublished}`
    )
  }
  if (messageCountUnpublished !== 1) {
    throw new Error(
      `Unpublished message count should be 1, but it is ${messageCountUnpublished}`
    )
  }

  // Publish the prepared message
  await alixGroup.publishPreparedMessages()

  // Sync the group after publishing the message
  await alixGroup.sync()

  // Verify the message counts again
  messageCountPublished = (
    await alixGroup.messages({
      deliveryStatus: MessageDeliveryStatus.PUBLISHED,
    })
  ).length
  messageCountUnpublished = (
    await alixGroup.messages({
      deliveryStatus: MessageDeliveryStatus.UNPUBLISHED,
    })
  ).length
  messageCount = (await alixGroup.messages()).length
  if (messageCountPublished !== 1) {
    throw new Error(
      `Published message count should be 1, but it is ${messageCountPublished}`
    )
  }
  if (messageCountUnpublished !== 0) {
    throw new Error(
      `Unpublished message count should be 0, but it is ${messageCountUnpublished}`
    )
  }
  if (messageCount !== 1) {
    throw new Error(`Message count should be 1, but it is ${messageCount}`)
  }

  // Retrieve all messages and verify the prepared message ID
  const messages = await alixGroup.messages()
  if (preparedMessageId !== messages[0].id) {
    throw new Error(`Message ID should match the prepared message ID`)
  }

  return true
})

test('can add members to a group', async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3)

  // alix's num groups start at 0
  let alixGroups = await alixClient.conversations.listGroups()
  if (alixGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // bo's num groups start at 0
  let boGroups = await boClient.conversations.listGroups()
  if (boGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // caro's num groups start at 0
  let caroGroups = await caroClient.conversations.listGroups()
  if (caroGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([boClient.address])

  // alix's num groups == 1
  await alixClient.conversations.syncGroups()
  alixGroups = await alixClient.conversations.listGroups()
  if (alixGroups.length !== 1) {
    throw new Error('num groups should be 1')
  }

  // alix can confirm memberInboxIds
  await alixGroup.sync()
  const memberInboxIds = await alixGroup.memberInboxIds()
  if (memberInboxIds.length !== 2) {
    throw new Error('num group members should be 2')
  }
  if (
    !(
      memberInboxIds.includes(alixClient.inboxId) &&
      memberInboxIds.includes(boClient.inboxId)
    )
  ) {
    throw new Error('missing address')
  }

  // alix can send messages
  await alixGroup.send('hello, world')
  await alixGroup.send('gm')

  // bo's num groups == 1
  await boClient.conversations.syncGroups()
  boGroups = await boClient.conversations.listGroups()
  if (boGroups.length !== 1) {
    throw new Error(
      'num groups for bo should be 1, but it is' + boGroups.length
    )
  }

  await alixGroup.addMembers([caroClient.address])

  // caro's num groups == 1
  await caroClient.conversations.syncGroups()
  caroGroups = await caroClient.conversations.listGroups()
  if (caroGroups.length !== 1) {
    throw new Error(
      'num groups for caro should be 1, but it is' + caroGroups.length
    )
  }
  await caroGroups[0].sync()
  const caroMessages = await caroGroups[0].messages()
  if (caroMessages.length !== 0) {
    throw new Error('num messages for caro should be 0')
  }

  await boGroups[0].sync()
  const boGroupMembers = await boGroups[0].memberInboxIds()
  if (boGroupMembers.length !== 3) {
    throw new Error('num group members should be 3')
  }

  return true
})

test('can remove members from a group', async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3)

  // alix's num groups start at 0
  let alixGroups = await alixClient.conversations.listGroups()
  if (alixGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // bo's num groups start at 0
  let boGroups = await boClient.conversations.listGroups()
  assert(boGroups.length === 0, 'num groups should be 0')

  // caro's num groups start at 0
  let caroGroups = await caroClient.conversations.listGroups()
  if (caroGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.address,
    caroClient.address,
  ])

  // alix's num groups == 1
  await alixClient.conversations.syncGroups()
  alixGroups = await alixClient.conversations.listGroups()
  if (alixGroups.length !== 1) {
    throw new Error('num groups should be 1')
  }

  // alix can confirm memberInboxIds
  await alixGroup.sync()
  const memberInboxIds = await alixGroup.memberInboxIds()
  if (memberInboxIds.length !== 3) {
    throw new Error('num group members should be 3')
  }
  if (
    !(
      memberInboxIds.includes(alixClient.inboxId) &&
      memberInboxIds.includes(boClient.inboxId)
    )
  ) {
    throw new Error('missing address')
  }

  // alix can send messages
  await alixGroup.send('hello, world')
  await alixGroup.send('gm')

  // bo's num groups == 1
  await boClient.conversations.syncGroups()
  boGroups = await boClient.conversations.listGroups()
  if (boGroups.length !== 1) {
    throw new Error(
      'num groups for bo should be 1, but it is' + boGroups.length
    )
  }

  // caro's num groups == 1
  await caroClient.conversations.syncGroups()
  caroGroups = await caroClient.conversations.listGroups()
  if (caroGroups.length !== 1) {
    throw new Error(
      'num groups for caro should be 1, but it is' + caroGroups.length
    )
  }

  await caroGroups[0].sync()
  if (!caroGroups[0].isActive()) {
    throw new Error('caros group should be active')
  }

  await alixGroup.removeMembers([caroClient.address])
  await alixGroup.sync()
  const alixGroupMembers = await alixGroup.memberInboxIds()
  if (alixGroupMembers.length !== 2) {
    throw new Error(
      'num group members should be 2 but was' + alixGroupMembers.length
    )
  }

  await caroGroups[0].sync()
  if (await caroGroups[0].isActive()) {
    throw new Error('caros group should not be active')
  }

  const caroGroupMembers = await caroGroups[0].memberInboxIds()
  if (caroGroupMembers.length !== 2) {
    throw new Error(
      'num group members should be 2 but was' + caroGroupMembers.length
    )
  }

  return true
})

test('can remove and add members from a group by inbox id', async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3)

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.address,
    caroClient.address,
  ])

  // alix can confirm memberInboxIds
  await alixGroup.sync()
  const memberInboxIds = await alixGroup.memberInboxIds()
  if (memberInboxIds.length !== 3) {
    throw new Error('num group members should be 3')
  }

  await alixGroup.removeMembersByInboxId([caroClient.inboxId])
  await alixGroup.sync()
  const alixGroupMembers = await alixGroup.memberInboxIds()
  if (alixGroupMembers.length !== 2) {
    throw new Error('num group members should be 2')
  }

  await alixGroup.addMembersByInboxId([caroClient.inboxId])
  await alixGroup.sync()
  const alixGroupMembers2 = await alixGroup.memberInboxIds()
  if (alixGroupMembers2.length !== 3) {
    throw new Error('num group members should be 3')
  }

  return true
})

test('can stream both groups and messages at same time', async () => {
  const [alix, bo] = await createClients(2)

  let groupCallbacks = 0
  let messageCallbacks = 0
  await bo.conversations.streamGroups(async () => {
    groupCallbacks++
  })

  await bo.conversations.streamAllMessages(async () => {
    messageCallbacks++
  }, true)

  const group = await alix.conversations.newGroup([bo.address])
  await group.send('hello')

  await delayToPropogate()
  // await new Promise((resolve) => setTimeout(resolve, 10000))
  assert(
    messageCallbacks === 1,
    'message stream should have received 1 message'
  )
  assert(groupCallbacks === 1, 'group stream should have received 1 group')
  return true
})

test('can stream groups', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  // Start streaming groups
  const groups: Group<any>[] = []
  const cancelStreamGroups = await alixClient.conversations.streamGroups(
    async (group: Group<any>) => {
      groups.push(group)
    }
  )

  // caro creates a group with alix, so stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const caroGroup = await caroClient.conversations.newGroup([
    alixClient.address,
  ])
  await delayToPropogate()
  if ((groups.length as number) !== 1) {
    throw Error('Unexpected num groups (should be 1): ' + groups.length)
  }

  assert(groups[0].members.length === 2, 'should be 2')

  // bo creates a group with alix so a stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const boGroup = await boClient.conversations.newGroup([alixClient.address])
  await delayToPropogate()
  if ((groups.length as number) !== 2) {
    throw Error('Unexpected num groups (should be 2): ' + groups.length)
  }

  // * Note alix creating a group does not trigger alix conversations
  // group stream. Workaround is to syncGroups after you create and list manually
  // See https://github.com/xmtp/libxmtp/issues/504

  // alix creates a group
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.address,
    caroClient.address,
  ])
  await delayToPropogate()
  if (groups.length !== 3) {
    throw Error('Expected group length 3 but it is: ' + groups.length)
  }
  // Sync groups after creation if you created a group
  const listedGroups = await alixClient.conversations.listGroups()
  await delayToPropogate()
  groups.push(listedGroups[listedGroups.length - 1])
  if ((groups.length as number) !== 4) {
    throw Error('Expected group length 4 but it is: ' + groups.length)
  }

  cancelStreamGroups()
  await delayToPropogate()

  // Creating a group should no longer trigger stream groups
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const caroSecond = await caroClient.conversations.newGroup([
    alixClient.address,
  ])
  await delayToPropogate()
  if ((groups.length as number) !== 4) {
    throw Error('Unexpected num groups (should be 4): ' + groups.length)
  }

  return true
})

test('can list groups with params', async () => {
  const [alixClient, boClient] = await createClients(2)

  const boGroup1 = await boClient.conversations.newGroup([alixClient.address])
  const boGroup2 = await boClient.conversations.newGroup([alixClient.address])

  await boGroup1.send({ text: `first message` })
  await boGroup1.send({ text: `second message` })
  await boGroup1.send({ text: `third message` })
  await boGroup2.send({ text: `first message` })

  const boGroupsOrderCreated = await boClient.conversations.listGroups()
  const boGroupsOrderLastMessage = await boClient.conversations.listGroups(
    { lastMessage: true },
    'lastMessage'
  )
  const boGroupsLimit = await boClient.conversations.listGroups(
    {},
    undefined,
    1
  )

  assert(
    boGroupsOrderCreated.map((group: any) => group.id).toString() ===
      [boGroup1.id, boGroup2.id].toString(),
    `Group order should be group1 then group2 but was ${boGroupsOrderCreated.map((group: any) => group.id).toString()}`
  )

  assert(
    boGroupsOrderLastMessage.map((group: any) => group.id).toString() ===
      [boGroup2.id, boGroup1.id].toString(),
    `Group order should be group2 then group1 but was ${boGroupsOrderLastMessage.map((group: any) => group.id).toString()}`
  )

  const messages = await boGroupsOrderLastMessage[0].messages()
  assert(
    messages[0].content() === 'first message',
    `last message should be first message ${messages[0].content()}`
  )
  assert(
    boGroupsOrderLastMessage[0].lastMessage?.content() === 'first message',
    `last message should be last message ${boGroupsOrderLastMessage[0].lastMessage?.content()}`
  )
  assert(
    boGroupsLimit.length === 1,
    `List length should be 1 but was ${boGroupsLimit.length}`
  )
  assert(
    boGroupsLimit[0].id === boGroup1.id,
    `Group should be ${boGroup1.id} but was ${boGroupsLimit[0].id}`
  )

  return true
})

test('can list groups', async () => {
  const [alixClient, boClient] = await createClients(2)

  const group1 = await boClient.conversations.newGroup([alixClient.address], {
    name: 'group1 name',
    imageUrlSquare: 'www.group1image.com',
  })
  const group2 = await boClient.conversations.newGroup([alixClient.address], {
    name: 'group2 name',
    imageUrlSquare: 'www.group2image.com',
  })

  const boGroups = await boClient.conversations.listGroups()
  await alixClient.conversations.syncGroups()
  const alixGroups = await alixClient.conversations.listGroups()

  assert(
    boGroups.length === alixGroups.length,
    `group lengths should be the same but bo was ${boGroups.length} and alix was ${alixGroups.length}`
  )

  const boGroup1 = await boClient.conversations.findGroup(group1.id)
  const boGroup2 = await boClient.conversations.findGroup(group2.id)

  const alixGroup1 = await alixClient.conversations.findGroup(group1.id)
  const alixGroup2 = await alixClient.conversations.findGroup(group2.id)

  assert(
    boGroup2?.name === 'group2 name',
    `Group 2 name for bo should be group2 name but was ${boGroup2?.name}`
  )

  assert(
    boGroup1?.imageUrlSquare === 'www.group1image.com',
    `Group 2 url for bo should be www.group1image.com but was ${boGroup1?.imageUrlSquare}`
  )

  assert(
    alixGroup1?.name === 'group1 name',
    `Group 1 name for alix should be group1 name but was ${alixGroup1?.name}`
  )

  assert(
    alixGroup2?.imageUrlSquare === 'www.group2image.com',
    `Group 2 url for alix should be www.group2image.com but was ${alixGroup2?.imageUrlSquare}`
  )

  assert(boGroup1?.isGroupActive === true, `Group 1 should be active for bo`)

  return true
})

test('can list all groups and conversations', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  // Add one group and one conversation
  const boGroup = await boClient.conversations.newGroup([alixClient.address])
  const alixConversation = await alixClient.conversations.newConversation(
    caroClient.address
  )

  const listedContainers = await alixClient.conversations.listAll()

  // Verify information in listed containers is correct
  // BUG - List All returns in Chronological order on iOS
  // and reverse Chronological order on Android
  const first = 0
  const second = 1
  if (
    listedContainers[first].topic !== boGroup.topic ||
    listedContainers[first].version !== ConversationVersion.GROUP ||
    listedContainers[second].version !== ConversationVersion.DIRECT ||
    listedContainers[second].createdAt !== alixConversation.createdAt
  ) {
    throw Error('Listed containers should match streamed containers')
  }

  return true
})

test('can stream all groups and conversations', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  // Start streaming groups and conversations
  const containers: ConversationContainer<any>[] = []
  const cancelStreamAll = await alixClient.conversations.streamAll(
    async (conversationContainer: ConversationContainer<any>) => {
      containers.push(conversationContainer)
    }
  )

  // bo creates a group with alix, so stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const boGroup = await boClient.conversations.newGroup([alixClient.address])
  await delayToPropogate()
  if ((containers.length as number) !== 1) {
    throw Error('Unexpected num groups (should be 1): ' + containers.length)
  }

  // bo creates a v2 Conversation with alix so a stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const boConversation = await boClient.conversations.newConversation(
    alixClient.address
  )
  await delayToPropogate()
  if ((containers.length as number) !== 2) {
    throw Error('Unexpected num groups (should be 2): ' + containers.length)
  }

  if (
    containers[1].version === ConversationVersion.DIRECT &&
    boConversation.conversationID !==
      (containers[1] as Conversation<any>).conversationID
  ) {
    throw Error(
      'Conversation from streamed all should match conversationID with created conversation'
    )
  }

  // * Note alix creating a v2 Conversation does trigger alix conversations
  // stream.

  // alix creates a V2 Conversationgroup
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const alixConversation = await alixClient.conversations.newConversation(
    caroClient.address
  )
  await delayToPropogate()
  if (containers.length !== 3) {
    throw Error('Expected group length 3 but it is: ' + containers.length)
  }

  cancelStreamAll()
  await delayToPropogate()

  // Creating a group should no longer trigger stream groups
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const caroConversation = await caroClient.conversations.newGroup([
    alixClient.address,
  ])
  await delayToPropogate()
  if ((containers.length as number) !== 3) {
    throw Error('Unexpected num groups (should be 3): ' + containers.length)
  }

  return true
})

test('can stream groups and messages', async () => {
  const [alixClient, boClient] = await createClients(2)

  // Start streaming groups
  const groups: Group<any>[] = []
  await alixClient.conversations.streamGroups(async (group: Group<any>) => {
    groups.push(group)
  })
  // Stream messages twice
  await alixClient.conversations.streamAllMessages(async (message) => {}, true)
  await alixClient.conversations.streamAllMessages(async (message) => {}, true)

  // bo creates a group with alix so a stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  await boClient.conversations.newGroup([alixClient.address])
  await delayToPropogate()
  if ((groups.length as number) !== 1) {
    throw Error(`Unexpected num groups (should be 1): ${groups.length}`)
  }

  return true
})

test('canMessage', async () => {
  const [bo, alix, caro] = await createClients(3)

  const canMessage = await bo.canMessage(alix.address)
  if (!canMessage) {
    throw new Error('should be able to message v2 client')
  }

  const canMessageV3 = await caro.canGroupMessage([
    caro.address,
    alix.address,
    '0x0000000000000000000000000000000000000000',
  ])

  assert(
    canMessageV3['0x0000000000000000000000000000000000000000'] === false,
    `should not be able to message 0x0000000000000000000000000000000000000000`
  )

  assert(
    canMessageV3[caro.address.toLowerCase()] === true,
    `should be able to message ${caro.address}`
  )

  assert(
    canMessageV3[alix.address.toLowerCase()] === true,
    `should be able to message ${alix.address}`
  )

  return true
})

test('can stream group messages', async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3)

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.address,
    caroClient.address,
  ])

  // Record message stream for this group
  const groupMessages: DecodedMessage[] = []
  const cancelGroupMessageStream = await alixGroup.streamGroupMessages(
    async (message) => {
      groupMessages.push(message)
    }
  )

  // bo's num groups == 1
  await boClient.conversations.syncGroups()
  const boGroup = (await boClient.conversations.listGroups())[0]

  for (let i = 0; i < 5; i++) {
    await boGroup.send({ text: `Message ${i}` })
    await delayToPropogate()
  }

  if (groupMessages.length !== 5) {
    throw Error('Unexpected convo messages count ' + groupMessages.length)
  }
  for (let i = 0; i < 5; i++) {
    if (groupMessages[i].content() !== `Message ${i}`) {
      throw Error(
        'Unexpected group message content ' + groupMessages[i].content()
      )
    }
  }

  cancelGroupMessageStream()
  for (let i = 0; i < 5; i++) {
    await boGroup.send({ text: `Message ${i}` })
  }

  if (groupMessages.length !== 5) {
    throw Error('Unexpected convo messages count ' + groupMessages.length)
  }

  return true
})

test('can stream all messages', async () => {
  const [alix, bo, caro] = await createClients(3)

  await delayToPropogate()

  // Record message stream across all conversations
  const allMessages: DecodedMessage[] = []
  await alix.conversations.streamAllMessages(async (message) => {
    allMessages.push(message)
  })

  // Start bo starts a new conversation.
  const boConvo = await bo.conversations.newConversation(alix.address)
  await delayToPropogate()

  for (let i = 0; i < 5; i++) {
    await boConvo.send({ text: `Message ${i}` })
    await delayToPropogate()
  }

  const count = allMessages.length
  if (count !== 5) {
    throw Error('Unexpected all messages count ' + allMessages.length)
  }

  const caroConvo = await caro.conversations.newConversation(alix.address)
  const caroGroup = await caro.conversations.newGroup([alix.address])
  await delayToPropogate()
  for (let i = 0; i < 5; i++) {
    await caroConvo.send({ text: `Message ${i}` })
    await caroGroup.send({ text: `Message ${i}` })
    await delayToPropogate()
  }

  if (allMessages.length !== 10) {
    throw Error('Unexpected all messages count ' + allMessages.length)
  }

  alix.conversations.cancelStreamAllMessages()

  await alix.conversations.streamAllMessages(async (message) => {
    allMessages.push(message)
  }, true)

  for (let i = 0; i < 5; i++) {
    await boConvo.send({ text: `Message ${i}` })
    await caroGroup.send({ text: `Message ${i}` })
    await delayToPropogate()
  }
  if (allMessages.length <= 15) {
    throw Error('Unexpected all messages count ' + allMessages.length)
  }

  return true
})

test('can make a group with metadata', async () => {
  const [alix, bo] = await createClients(2)
  bo.register(new GroupUpdatedCodec())

  const alixGroup = await alix.conversations.newGroup([bo.address], {
    name: 'Start Name',
    imageUrlSquare: 'starturl.com',
    description: 'a fun description',
  })

  const groupName1 = await alixGroup.groupName()
  const groupImageUrl1 = await alixGroup.groupImageUrlSquare()
  const groupDescription1 = await alixGroup.groupDescription()
  assert(
    groupName1 === 'Start Name',
    `the group should start with a name of Start Name not ${groupName1}`
  )

  assert(
    groupImageUrl1 === 'starturl.com',
    `the group should start with a name of starturl.com not ${groupImageUrl1}`
  )

  assert(
    groupDescription1 === 'a fun description',
    `the group should start with a name of a fun description not ${groupDescription1}`
  )

  await alixGroup.updateGroupName('New Name')
  await alixGroup.updateGroupImageUrlSquare('newurl.com')
  await alixGroup.updateGroupDescription('a new group description')
  await alixGroup.sync()
  await bo.conversations.syncGroups()
  const boGroups = await bo.conversations.listGroups()
  const boGroup = boGroups[0]
  await boGroup.sync()

  const groupName2 = await alixGroup.groupName()
  const groupImageUrl2 = await alixGroup.groupImageUrlSquare()
  const groupDescription2 = await alixGroup.groupDescription()
  assert(
    groupName2 === 'New Name',
    `the group should start with a name of New Name not ${groupName2}`
  )

  assert(
    groupImageUrl2 === 'newurl.com',
    `the group should start with a name of newurl.com not ${groupImageUrl2}`
  )

  assert(
    groupDescription2 === 'a new group description',
    `the group should start with a name of a new group description not ${groupDescription2}`
  )

  const groupName3 = await boGroup.groupName()
  const groupImageUrl3 = await boGroup.groupImageUrlSquare()
  assert(
    groupName3 === 'New Name',
    `the group should start with a name of New Name not ${groupName3}`
  )

  assert(
    groupImageUrl3 === 'newurl.com',
    `the group should start with a name of newurl.com not ${groupImageUrl3}`
  )

  const boMessages = await boGroup.messages()
  assert(
    boMessages[0].contentTypeId === 'xmtp.org/group_updated:1.0',
    'Unexpected message content ' + JSON.stringify(boMessages[0].contentTypeId)
  )

  const message = boMessages[1].content() as GroupUpdatedContent
  assert(
    message.metadataFieldsChanged[0].fieldName === 'group_image_url_square',
    `the metadata field changed should be group_image_url_square but was ${message.metadataFieldsChanged[0].fieldName}`
  )
  const message2 = boMessages[0].content() as GroupUpdatedContent
  assert(
    message2.metadataFieldsChanged[0].fieldName === 'description',
    `the metadata field changed should be description but was ${message2.metadataFieldsChanged[0].fieldName}`
  )
  return true
})

test('can make a group with admin permissions', async () => {
  const [adminClient, anotherClient] = await createClients(2)

  const group = await adminClient.conversations.newGroup(
    [anotherClient.address],
    { permissionLevel: 'admin_only' }
  )

  if ((await group.permissionPolicySet()).addMemberPolicy !== 'admin') {
    throw Error(
      `Group permission level should be admin but was ${
        (await group.permissionPolicySet()).addMemberPolicy
      }`
    )
  }

  const isSuperAdmin = await group.isSuperAdmin(adminClient.inboxId)
  if (!isSuperAdmin) {
    throw Error(`adminClient should be the super admin`)
  }

  // Creator id not working, see https://github.com/xmtp/libxmtp/issues/788
  // if (group.creatorInboxId !== adminClient.inboxId) {
  //   throw Error(
  //     `adminClient should be the creator but was ${group.creatorInboxId}`
  //   )
  // }

  return true
})

test('can paginate group messages', async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient] = await createClients(2)

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([boClient.address])

  // alix can send messages
  await alixGroup.send('hello, world')
  await alixGroup.send('gm')

  await boClient.conversations.syncGroups()
  const boGroups = await boClient.conversations.listGroups()
  if (boGroups.length !== 1) {
    throw new Error(
      'num groups for bo should be 1, but it is' + boGroups.length
    )
  }
  await delayToPropogate()
  // bo can read messages from alix
  await boGroups[0].sync()
  const boMessages: DecodedMessage[] = await boGroups[0].messages({
    limit: 1,
  })

  if (boMessages.length !== 1) {
    throw Error(`Should limit just 1 message but was ${boMessages.length}`)
  }

  return true
})

test('can stream all group messages', async () => {
  const [alix, bo, caro] = await createClients(3)

  await delayToPropogate()

  // Start bo starts a new group.
  const boGroup = await bo.conversations.newGroup([alix.address])
  await delayToPropogate()

  // Starts a new conversation.
  const caroGroup = await caro.conversations.newGroup([alix.address])

  // Record message stream across all conversations
  const allMessages: DecodedMessage[] = []
  // If we don't call syncGroups here, the streamAllGroupMessages will not
  // stream the first message. Feels like a bug.
  await alix.conversations.syncGroups()
  await alix.conversations.streamAllGroupMessages(async (message) => {
    allMessages.push(message)
  })

  for (let i = 0; i < 5; i++) {
    await boGroup.send({ text: `Message ${i}` })
    await delayToPropogate()
  }

  const count = allMessages.length
  if (count !== 5) {
    throw Error('Unexpected all messages count first' + allMessages.length)
  }

  await delayToPropogate()
  for (let i = 0; i < 5; i++) {
    await caroGroup.send({ text: `Message ${i}` })
    await delayToPropogate()
  }

  if (allMessages.length !== 10) {
    throw Error('Unexpected all messages count second' + allMessages.length)
  }

  alix.conversations.cancelStreamAllGroupMessages()
  await delayToPropogate()
  await alix.conversations.streamAllGroupMessages(async (message) => {
    allMessages.push(message)
  })

  for (let i = 0; i < 5; i++) {
    await boGroup.send({ text: `Message ${i}` })
    await delayToPropogate()
  }
  if (allMessages.length <= 10) {
    throw Error('Unexpected all messages count ' + allMessages.length)
  }

  return true
})

test('can streamAll from multiple clients', async () => {
  const [alix, bo, caro] = await createClients(3)

  // Setup stream alls
  const allBoConversations: any[] = []
  const allAliConversations: any[] = []

  await bo.conversations.streamAll(async (conversation) => {
    allBoConversations.push(conversation)
  })
  await alix.conversations.streamAll(async (conversation) => {
    allAliConversations.push(conversation)
  })

  // Start Caro starts a new conversation.
  await caro.conversations.newConversation(alix.address)
  await delayToPropogate()
  if (allBoConversations.length !== 0) {
    throw Error(
      'Unexpected all conversations count for Bo ' +
        allBoConversations.length +
        ' and Alix had ' +
        allAliConversations.length
    )
  }
  if (allAliConversations.length !== 1) {
    throw Error(
      'Unexpected all conversations count ' + allAliConversations.length
    )
  }
  return true
})

test('can streamAll from multiple clients - swapped orderring', async () => {
  const [alix, bo, caro] = await createClients(3)

  // Setup stream alls
  const allBoConversations: any[] = []
  const allAliConversations: any[] = []

  await alix.conversations.streamAll(async (conversation) => {
    allAliConversations.push(conversation)
  })

  await bo.conversations.streamAll(async (conversation) => {
    allBoConversations.push(conversation)
  })

  // Start Caro starts a new conversation.
  await caro.conversations.newConversation(alix.address)
  await delayToPropogate()
  if (allBoConversations.length !== 0) {
    throw Error(
      'Unexpected all conversations count for Bo ' +
        allBoConversations.length +
        ' and Alix had ' +
        allAliConversations.length
    )
  }
  if (allAliConversations.length !== 1) {
    throw Error(
      'Unexpected all conversations count ' + allAliConversations.length
    )
  }
  return true
})

test('can streamAllMessages from multiple clients', async () => {
  const [alix, bo, caro] = await createClients(3)

  // Setup stream
  const allBoMessages: any[] = []
  const allAliMessages: any[] = []

  await bo.conversations.streamAllMessages(async (conversation) => {
    allBoMessages.push(conversation)
  }, true)
  await alix.conversations.streamAllMessages(async (conversation) => {
    allAliMessages.push(conversation)
  }, true)

  // Start Caro starts a new conversation.
  const caroConversation = await caro.conversations.newConversation(
    alix.address
  )
  await caroConversation.send({ text: `Message` })
  await delayToPropogate()
  if (allBoMessages.length !== 0) {
    throw Error('Unexpected all messages count for Bo ' + allBoMessages.length)
  }

  if (allAliMessages.length !== 1) {
    throw Error(
      'Unexpected all conversations count for Ali ' + allAliMessages.length
    )
  }

  return true
})

test('can streamAllMessages from multiple clients - swapped', async () => {
  const [alix, bo, caro] = await createClients(3)

  // Setup stream
  const allBoMessages: any[] = []
  const allAliMessages: any[] = []
  const caroGroup = await caro.conversations.newGroup([alix.address])

  await alix.conversations.streamAllMessages(async (conversation) => {
    allAliMessages.push(conversation)
  }, true)
  await bo.conversations.streamAllMessages(async (conversation) => {
    allBoMessages.push(conversation)
  }, true)

  // Start Caro starts a new conversation.
  const caroConvo = await caro.conversations.newConversation(alix.address)
  await delayToPropogate()
  await caroConvo.send({ text: `Message` })
  await caroGroup.send({ text: `Message` })
  await delayToPropogate()
  if (allBoMessages.length !== 0) {
    throw Error(
      'Unexpected all conversations count for Bo ' + allBoMessages.length
    )
  }

  if (allAliMessages.length !== 2) {
    throw Error(
      'Unexpected all conversations count for Ali ' + allAliMessages.length
    )
  }

  return true
})

test('can stream all group Messages from multiple clients', async () => {
  const [alix, bo, caro] = await createClients(3)

  // Setup stream
  const allAlixMessages: DecodedMessage[] = []
  const allBoMessages: DecodedMessage[] = []
  const alixGroup = await caro.conversations.newGroup([alix.address])
  const boGroup = await caro.conversations.newGroup([bo.address])

  await alixGroup.streamGroupMessages(async (message) => {
    allAlixMessages.push(message)
  })
  await boGroup.streamGroupMessages(async (message) => {
    allBoMessages.push(message)
  })

  // Start Caro starts a new conversation.
  await delayToPropogate()
  await alixGroup.send({ text: `Message` })
  await delayToPropogate()
  if (allBoMessages.length !== 0) {
    throw Error('Unexpected all messages count for Bo ' + allBoMessages.length)
  }

  if (allAlixMessages.length !== 1) {
    throw Error(
      'Unexpected all messages count for Ali ' + allAlixMessages.length
    )
  }

  await alix.conversations.syncGroups()
  const alixConv = (await alix.conversations.listGroups())[0]
  await alixConv.send({ text: `Message` })
  await delayToPropogate()
  if (allBoMessages.length !== 0) {
    throw Error('Unexpected all messages count for Bo ' + allBoMessages.length)
  }
  // @ts-ignore-next-line
  if (allAlixMessages.length !== 2) {
    throw Error(
      'Unexpected all messages count for Ali ' + allAlixMessages.length
    )
  }

  return true
})

test('can stream all group Messages from multiple clients - swapped', async () => {
  const [alix, bo, caro] = await createClients(3)

  // Setup stream
  const allAlixMessages: DecodedMessage[] = []
  const allBoMessages: DecodedMessage[] = []
  const alixGroup = await caro.conversations.newGroup([alix.address])
  const boGroup = await caro.conversations.newGroup([bo.address])

  await boGroup.streamGroupMessages(async (message) => {
    allBoMessages.push(message)
  })
  await alixGroup.streamGroupMessages(async (message) => {
    allAlixMessages.push(message)
  })

  // Start Caro starts a new conversation.
  await delayToPropogate()
  await alixGroup.send({ text: `Message` })
  await delayToPropogate()
  if (allBoMessages.length !== 0) {
    throw Error('Unexpected all messages count for Bo ' + allBoMessages.length)
  }

  if (allAlixMessages.length !== 1) {
    throw Error(
      'Unexpected all messages count for Ali ' + allAlixMessages.length
    )
  }

  await alix.conversations.syncGroups()
  const alixConv = (await alix.conversations.listGroups())[0]
  await alixConv.send({ text: `Message` })
  await delayToPropogate()
  if (allBoMessages.length !== 0) {
    throw Error('Unexpected all messages count for Bo ' + allBoMessages.length)
  }
  // @ts-ignore-next-line
  if (allAlixMessages.length !== 2) {
    throw Error(
      'Unexpected all messages count for Ali ' + allAlixMessages.length
    )
  }

  return true
})

test('creating a group should allow group', async () => {
  const [alix, bo] = await createClients(2)

  const group = await alix.conversations.newGroup([bo.address])
  const consent = await alix.contacts.isGroupAllowed(group.id)
  const groupConsent = await group.isAllowed()

  if (!consent || !groupConsent) {
    throw Error('Group should be allowed')
  }

  const state = await group.consentState()
  assert(
    state === 'allowed',
    `the message should have a consent state of allowed but was ${state}`
  )

  const consentList = await alix.contacts.consentList()
  assert(
    consentList[0].permissionType === 'allowed',
    `the message should have a consent state of allowed but was ${consentList[0].permissionType}`
  )

  return true
})

test('can group consent', async () => {
  const [alix, bo] = await createClients(2)
  const group = await bo.conversations.newGroup([alix.address])
  let isAllowed = await alix.contacts.isGroupAllowed(group.id)
  assert(
    isAllowed === false,
    `alix group should NOT be allowed but was ${isAllowed}`
  )

  isAllowed = await bo.contacts.isGroupAllowed(group.id)
  assert(isAllowed === true, `bo group should be allowed but was ${isAllowed}`)
  assert(
    (await group.state) === 'allowed',
    `the group should have a consent state of allowed but was ${await group.state}`
  )

  await bo.contacts.denyGroups([group.id])
  const isDenied = await bo.contacts.isGroupDenied(group.id)
  assert(isDenied === true, `bo group should be denied but was ${isDenied}`)
  assert(
    (await group.consentState()) === 'denied',
    `the group should have a consent state of denied but was ${await group.consentState()}`
  )

  await group.updateConsent('allowed')
  isAllowed = await bo.contacts.isGroupAllowed(group.id)
  assert(isAllowed === true, `bo group should be allowed2 but was ${isAllowed}`)
  assert(
    (await group.consentState()) === 'allowed',
    `the group should have a consent state2 of allowed but was ${await group.consentState()}`
  )

  return true
})

test('can allow and deny a inbox id', async () => {
  const [alix, bo] = await createClients(2)
  const boGroup = await bo.conversations.newGroup([alix.address])

  let isInboxAllowed = await bo.contacts.isInboxAllowed(alix.inboxId)
  let isInboxDenied = await bo.contacts.isInboxDenied(alix.inboxId)
  assert(
    isInboxAllowed === false,
    `isInboxAllowed should be false but was ${isInboxAllowed}`
  )
  assert(
    isInboxDenied === false,
    `isInboxDenied should be false but was ${isInboxDenied}`
  )

  await bo.contacts.allowInboxes([alix.inboxId])

  let alixMember = (await boGroup.membersList()).find(
    (member) => member.inboxId === alix.inboxId
  )
  assert(
    alixMember?.consentState === 'allowed',
    `alixMember should be allowed but was ${alixMember?.consentState}`
  )

  isInboxAllowed = await bo.contacts.isInboxAllowed(alix.inboxId)
  isInboxDenied = await bo.contacts.isInboxDenied(alix.inboxId)
  assert(
    isInboxAllowed === true,
    `isInboxAllowed2 should be true but was ${isInboxAllowed}`
  )
  assert(
    isInboxDenied === false,
    `isInboxDenied2 should be false but was ${isInboxDenied}`
  )

  let isAddressAllowed = await bo.contacts.isAllowed(alix.address)
  let isAddressDenied = await bo.contacts.isDenied(alix.address)
  assert(
    isAddressAllowed === true,
    `isAddressAllowed should be true but was ${isAddressAllowed}`
  )
  assert(
    isAddressDenied === false,
    `isAddressDenied should be false but was ${isAddressDenied}`
  )

  await bo.contacts.denyInboxes([alix.inboxId])

  alixMember = (await boGroup.membersList()).find(
    (member) => member.inboxId === alix.inboxId
  )
  assert(
    alixMember?.consentState === 'denied',
    `alixMember should be denied but was ${alixMember?.consentState}`
  )

  isInboxAllowed = await bo.contacts.isInboxAllowed(alix.inboxId)
  isInboxDenied = await bo.contacts.isInboxDenied(alix.inboxId)
  assert(
    isInboxAllowed === false,
    `isInboxAllowed3 should be false but was ${isInboxAllowed}`
  )
  assert(
    isInboxDenied === true,
    `isInboxDenied3 should be true but was ${isInboxDenied}`
  )

  await bo.contacts.allow([alix.address])

  isAddressAllowed = await bo.contacts.isAllowed(alix.address)
  isAddressDenied = await bo.contacts.isDenied(alix.address)
  assert(
    isAddressAllowed === true,
    `isAddressAllowed2 should be true but was ${isAddressAllowed}`
  )
  assert(
    isAddressDenied === false,
    `isAddressDenied2 should be false but was ${isAddressDenied}`
  )
  isInboxAllowed = await bo.contacts.isInboxAllowed(alix.inboxId)
  isInboxDenied = await bo.contacts.isInboxDenied(alix.inboxId)
  assert(
    isInboxAllowed === true,
    `isInboxAllowed4 should be false but was ${isInboxAllowed}`
  )
  assert(
    isInboxDenied === false,
    `isInboxDenied4 should be true but was ${isInboxDenied}`
  )

  return true
})

test('can check if group is allowed', async () => {
  const [alix, bo] = await createClients(2)
  const alixGroup = await alix.conversations.newGroup([bo.address])
  const startConsent = await bo.contacts.isGroupAllowed(alixGroup.id)
  if (startConsent) {
    throw Error('Group should not be allowed by default')
  }
  await bo.contacts.allowGroups([alixGroup.id])
  const consent = await bo.contacts.isGroupAllowed(alixGroup.id)
  if (!consent) {
    throw Error('Group should be allowed')
  }

  return true
})

test('can check if group is denied', async () => {
  const [alix, bo] = await createClients(2)
  const alixGroup = await alix.conversations.newGroup([bo.address])
  const startConsent = await bo.contacts.isGroupDenied(alixGroup.id)
  if (startConsent) {
    throw Error('Group should not be denied by default')
  }
  await bo.contacts.denyGroups([alixGroup.id])
  const consent = await bo.contacts.isGroupDenied(alixGroup.id)
  if (!consent) {
    throw Error('Group should be denied')
  }
  return true
})

test('sync function behaves as expected', async () => {
  const [alix, bo, caro] = await createClients(3)
  const alixGroup = await alix.conversations.newGroup([bo.address])

  await alixGroup.send({ text: 'hello' })

  // List groups will return empty until the first sync
  let boGroups = await bo.conversations.listGroups()
  assert(boGroups.length === 0, 'num groups for bo is 0 until we sync')

  await bo.conversations.syncGroups()

  boGroups = await bo.conversations.listGroups()
  assert(boGroups.length === 1, 'num groups for bo is 1')

  // Num members will include the initial num of members even before sync
  let numMembers = (await boGroups[0].memberInboxIds()).length
  assert(numMembers === 2, 'num members should be 2')

  // Num messages for a group will be 0 until we sync the group
  let numMessages = (await boGroups[0].messages()).length
  assert(numMessages === 0, 'num members should be 1')

  await bo.conversations.syncGroups()

  // Num messages is still 0 because we didnt sync the group itself
  numMessages = (await boGroups[0].messages()).length
  assert(numMessages === 0, 'num messages should be 0')

  await boGroups[0].sync()

  // after syncing the group we now see the correct number of messages
  numMessages = (await boGroups[0].messages()).length
  assert(numMessages === 1, 'num members should be 1')

  await alixGroup.addMembers([caro.address])

  numMembers = (await boGroups[0].memberInboxIds()).length
  assert(numMembers === 2, 'num members should be 2')

  await bo.conversations.syncGroups()

  // Even though we synced the groups, we need to sync the group itself to see the new member
  numMembers = (await boGroups[0].memberInboxIds()).length
  assert(numMembers === 2, 'num members should be 2')

  await boGroups[0].sync()

  numMembers = (await boGroups[0].memberInboxIds()).length
  assert(numMembers === 3, 'num members should be 3')

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _alixGroup2 = await alix.conversations.newGroup([
    bo.address,
    caro.address,
  ])
  await bo.conversations.syncGroups()
  boGroups = await bo.conversations.listGroups()
  assert(boGroups.length === 2, 'num groups for bo is 2')

  // Even before syncing the group, syncGroups will return the initial number of members
  numMembers = (await boGroups[1].memberInboxIds()).length
  assert(numMembers === 3, 'num members should be 3')

  return true
})

test('can read and update group name', async () => {
  const [alix, bo, caro] = await createClients(3)
  const alixGroup = await alix.conversations.newGroup([bo.address])

  await alixGroup.sync()
  let groupName = await alixGroup.groupName()

  assert(groupName === '', 'group name should be empty string')

  await alixGroup.updateGroupName('Test name update 1')

  await alixGroup.sync()
  groupName = await alixGroup.groupName()

  assert(
    groupName === 'Test name update 1',
    'group name should be "Test name update 1"'
  )

  await bo.conversations.syncGroups()
  const boGroup = (await bo.conversations.listGroups())[0]
  groupName = await boGroup.groupName()

  assert(groupName === '', 'group name should be empty string')

  await boGroup.sync()

  groupName = await boGroup.groupName()

  assert(
    groupName === 'Test name update 1',
    'group name should be "Test name update 1"'
  )

  await alixGroup.addMembers([caro.address])
  await caro.conversations.syncGroups()
  const caroGroup = (await caro.conversations.listGroups())[0]

  await caroGroup.sync()
  groupName = await caroGroup.groupName()
  assert(
    groupName === 'Test name update 1',
    'group name should be "Test name update 1"'
  )
  return true
})

test('can list groups does not fork', async () => {
  const [alix, bo] = await createClients(2)
  console.log('created clients')
  let groupCallbacks = 0
  //#region Stream groups
  await bo.conversations.streamGroups(async () => {
    console.log('group received')
    groupCallbacks++
  })
  //#region Stream All Messages
  await bo.conversations.streamAllMessages(async () => {
    console.log('message received')
  }, true)
  //#endregion
  // #region create group
  const alixGroup = await alix.conversations.newGroup([bo.address])
  await alixGroup.updateGroupName('hello')
  await alixGroup.send('hello1')
  console.log('sent group message')
  // #endregion
  // #region sync groups
  await bo.conversations.syncGroups()
  // #endregion
  const boGroups = await bo.conversations.listGroups()
  assert(boGroups.length === 1, 'bo should have 1 group')
  const boGroup = boGroups[0]
  await boGroup.sync()

  const boMessages1 = await boGroup.messages()
  assert(
    boMessages1.length === 2,
    `should have 2 messages on first load received ${boMessages1.length}`
  )
  await boGroup.send('hello2')
  await boGroup.send('hello3')
  await alixGroup.sync()
  const alixMessages = await alixGroup.messages()
  for (const message of alixMessages) {
    console.log(
      'message',
      message.contentTypeId,
      message.contentTypeId === 'xmtp.org/text:1.0'
        ? message.content()
        : 'Group Updated'
    )
  }
  // alix sees 3 messages
  assert(
    alixMessages.length === 5,
    `should have 5 messages on first load received ${alixMessages.length}`
  )
  await alixGroup.send('hello4')
  await boGroup.sync()
  const boMessages2 = await boGroup.messages()
  for (const message of boMessages2) {
    console.log(
      'message',
      message.contentTypeId,
      message.contentTypeId === 'xmtp.org/text:1.0'
        ? message.content()
        : 'Group Updated'
    )
  }
  // bo sees 4 messages
  assert(
    boMessages2.length === 5,
    `should have 5 messages on second load received ${boMessages2.length}`
  )

  await delayToPropogate(500)

  assert(groupCallbacks === 1, 'group stream should have received 1 group')

  return true
})

test('can create new installation without breaking group', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const wallet1 = Wallet.createRandom()
  const wallet2 = Wallet.createRandom()

  const client1 = await Client.create(wallet1, {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: keyBytes,
  })
  const client2 = await Client.create(wallet2, {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: keyBytes,
  })

  const group = await client1.conversations.newGroup([wallet2.address])

  await client1.conversations.syncGroups()
  await client2.conversations.syncGroups()

  const client1Group = await client1.conversations.findGroup(group.id)
  const client2Group = await client2.conversations.findGroup(group.id)

  await client1Group?.sync()
  await client2Group?.sync()

  assert(client1Group?.members?.length === 2, `client 1 should see 2 members`)

  assert(
    (await client2Group?.membersList())?.length === 2,
    `client 2 should see 2 members`
  )

  await client2.deleteLocalDatabase()

  // Recreating a client with wallet 2 (new installation!)
  await Client.create(wallet2, {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: keyBytes,
  })

  await client1Group?.send('This message will break the group')
  assert(
    client1Group?.members?.length === 2,
    `client 1 should still see the 2 members`
  )

  return true
})

test('can list many groups members in parallel', async () => {
  const [alix, bo] = await createClients(2)
  const groups: Group[] = await createGroups(alix, [bo], 20)

  try {
    await Promise.all(groups.slice(0, 10).map((g) => g.membersList()))
  } catch (e) {
    throw new Error(`Failed listing 10 groups members with ${e}`)
  }

  try {
    await Promise.all(groups.slice(0, 20).map((g) => g.membersList()))
  } catch (e) {
    throw new Error(`Failed listing 20 groups members with ${e}`)
  }

  return true
})

test('can sync all groups', async () => {
  const [alix, bo] = await createClients(2)
  const groups: Group[] = await createGroups(alix, [bo], 50)

  const alixGroup = groups[0]
  await bo.conversations.syncGroups()
  const boGroup = await bo.conversations.findGroup(alixGroup.id)
  await alixGroup.send('hi')
  assert(
    (await boGroup?.messages())?.length === 0,
    `messages should be empty before sync but was ${boGroup?.messages?.length}`
  )

  const numGroupsSynced = await bo.conversations.syncAllGroups()
  assert(
    (await boGroup?.messages())?.length === 1,
    `messages should be 4 after sync but was ${boGroup?.messages?.length}`
  )
  assert(
    numGroupsSynced === 50,
    `should have synced 50 groups but synced ${numGroupsSynced}`
  )

  for (const group of groups) {
    await group.removeMembers([bo.address])
  }

  // First syncAllGroups after removal will still sync each group to set group inactive
  // For some reason on Android (RN only), first syncAllGroups already returns 0
  const numGroupsSynced2 = await bo.conversations.syncAllGroups()
  if (Platform.OS === 'ios') {
    assert(
      numGroupsSynced2 === 50,
      `should have synced 50 groups but synced ${numGroupsSynced2}`
    )
  } else {
    assert(
      numGroupsSynced2 === 0,
      `should have synced 0 groups but synced ${numGroupsSynced2}`
    )
  }

  // Next syncAllGroups will not sync inactive groups
  const numGroupsSynced3 = await bo.conversations.syncAllGroups()
  assert(
    numGroupsSynced3 === 0,
    `should have synced 0 groups but synced ${numGroupsSynced3}`
  )
  return true
})

test('only streams groups that can be decrypted', async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3)
  const alixGroups: Group<any>[] = []
  const boGroups: Group<any>[] = []
  const caroGroups: Group<any>[] = []

  await alixClient.conversations.streamGroups(async (group: Group<any>) => {
    alixGroups.push(group)
  })
  await boClient.conversations.streamGroups(async (group: Group<any>) => {
    boGroups.push(group)
  })
  await caroClient.conversations.streamGroups(async (group: Group<any>) => {
    caroGroups.push(group)
  })

  await alixClient.conversations.newGroup([boClient.address])

  assert(
    alixGroups.length === 1,
    `alix group length should be 1 but was ${alixGroups.length}`
  )

  assert(
    boGroups.length === 1,
    `bo group length should be 1 but was ${boGroups.length}`
  )

  assert(
    caroGroups.length !== 1,
    `caro group length should be 0 but was ${caroGroups.length}`
  )

  return true
})

test('can stream groups and messages', async () => {
  for (let index = 0; index < 15; index++) {
    console.log(`stream groups & messages: test ${index}`)
    const [alixClient, boClient] = await createClients(2)

    // Start streaming groups
    const groups: Group<any>[] = []
    await alixClient.conversations.streamGroups(async (group: Group<any>) => {
      groups.push(group)
    })
    // Stream messages twice
    await alixClient.conversations.streamAllMessages(
      async (message) => {},
      true
    )
    await alixClient.conversations.streamAllMessages(
      async (message) => {},
      true
    )

    // bo creates a group with alix so a stream callback is fired
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    await boClient.conversations.newGroup([alixClient.address])
    await delayToPropogate(500)
    if ((groups.length as number) !== 1) {
      throw Error(`Unexpected num groups (should be 1): ${groups.length}`)
    }
  }

  return true
})

// Commenting this out so it doesn't block people, but nice to have?
// test('can stream messages for a long time', async () => {
//   const bo = await Client.createRandom({ env: 'local', enableV3: true })
//   await delayToPropogate()
//   const alix = await Client.createRandom({ env: 'local', enableV3: true })
//   await delayToPropogate()
//   const caro = await Client.createRandom({ env: 'local', enableV3: true })
//   await delayToPropogate()

//   // Setup stream alls
//   const allBoMessages: any[] = []
//   const allAliMessages: any[] = []

//   const group = await caro.conversations.newGroup([alix.address])
//   await bo.conversations.streamAllMessages(async (conversation) => {
//     allBoMessages.push(conversation)
//   }, true)
//   await alix.conversations.streamAllMessages(async (conversation) => {
//     allAliMessages.push(conversation)
//   }, true)

//   // Wait for 15 minutes
//   await delayToPropogate(15 * 1000 * 60)

//   // Start Caro starts a new conversation.
//   const convo = await caro.conversations.newConversation(alix.address)
//   await group.send({ text: 'hello' })
//   await convo.send({ text: 'hello' })
//   await delayToPropogate()
//   if (allBoMessages.length !== 0) {
//     throw Error('Unexpected all conversations count ' + allBoMessages.length)
//   }
//   if (allAliMessages.length !== 2) {
//     throw Error('Unexpected all conversations count ' + allAliMessages.length)
//   }

//   return true
// })
