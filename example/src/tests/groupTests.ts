import RNFS from 'react-native-fs'
import { DecodedMessage } from 'xmtp-react-native-sdk/lib/DecodedMessage'

import {
  Test,
  assert,
  createClients,
  delayToPropogate,
  isIos,
} from './test-utils'
import {
  Client,
  Conversation,
  Group,
  ConversationContainer,
  ConversationVersion,
  MessageDeliveryStatus,
} from '../../../src/index'

export const groupTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  groupTests.push({ name: String(counter++) + '. ' + name, run: perform })
}

test('can make a MLS V3 client', async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const client = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableAlphaMls: true,
  })

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

  await client.deleteLocalDatabase()
  client = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableAlphaMls: true,
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
    enableAlphaMls: true,
    dbEncryptionKey: key,
    dbDirectory: dbDirPath,
  })

  const anotherClient = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableAlphaMls: true,
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
    enableAlphaMls: true,
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

test('can make a MLS V3 client from bundle', async () => {
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  const client = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableAlphaMls: true,
    dbEncryptionKey: key,
  })

  const anotherClient = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableAlphaMls: true,
    dbEncryptionKey: key,
  })

  const group1 = await client.conversations.newGroup([anotherClient.address])

  assert(
    group1.clientAddress === client.address,
    `clients dont match ${client.address} and ${group1.clientAddress}`
  )

  const bundle = await client.exportKeyBundle()
  const client2 = await Client.createFromKeyBundle(bundle, {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableAlphaMls: true,
    dbEncryptionKey: key,
  })

  assert(
    client.address === client2.address,
    `clients dont match ${client2.address} and ${client.address}`
  )

  const randomClient = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableAlphaMls: true,
    dbEncryptionKey: key,
  })

  const group = await client2.conversations.newGroup([randomClient.address])

  assert(
    group.clientAddress === client2.address,
    `clients dont match ${client2.address} and ${group.clientAddress}`
  )

  return true
})

test('production MLS V3 client creation throws error', async () => {
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  try {
    await Client.createRandom({
      env: 'production',
      appVersion: 'Testing/0.0.0',
      enableAlphaMls: true,
      dbEncryptionKey: key,
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return true
  }
  throw new Error(
    'should throw error on MLS V3 client create when environment is not local'
  )
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
    deliveryStatus: MessageDeliveryStatus.UNPUBLISHED,
  })

  assert(
    alixMessagesFiltered.length === 1,
    `the messages length should be 1 but was ${alixMessagesFiltered.length}`
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

test('who added me to a group', async () => {
  const [alixClient, boClient] = await createClients(2)
  await alixClient.conversations.newGroup([boClient.address])

  await boClient.conversations.syncGroups()
  const boGroup = (await boClient.conversations.listGroups())[0]
  const addedByInboxId = await boGroup.addedByInboxId()

  assert(
    addedByInboxId === alixClient.inboxId,
    `addedByInboxId ${addedByInboxId} does not match ${alixClient.inboxId}`
  )
  return true
})

test('can get members of a group', async () => {
  const [alixClient, boClient] = await createClients(2)
  const group = await alixClient.conversations.newGroup([boClient.address])

  const members = await group.members()

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
  const peerInboxIds = await alixGroup.peerInboxIds
  if (peerInboxIds.length !== 2) {
    throw new Error('num peer group members should be 2')
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

  if (
    !(
      peerInboxIds.includes(boClient.inboxId) &&
      peerInboxIds.includes(caroClient.inboxId)
    )
  ) {
    throw new Error('should include self')
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
  // should be 3 since they wont get new updates to the group after being removed
  if (caroGroupMembers.length !== 3) {
    throw new Error(
      'num group members should be 3 but was' + caroGroupMembers.length
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

test('stream groups and all messages', async () => {
  const [alixClient, boClient] = await createClients(2)
  console.log('Created clients')

  const aliceGroups = await alixClient.conversations.listGroups()
  console.log('Listed groups')
  assert(aliceGroups.length === 0, 'alice should have no groups')

  let groupCallbacks = 0
  let messageCallbacks = 0

  await alixClient.conversations.streamGroups(async () => {
    groupCallbacks++
  })

  await alixClient.conversations.streamAllMessages(async () => {
    messageCallbacks++
  }, true)

  console.log('setup streams')

  await delayToPropogate()

  const group = await boClient.conversations.newGroup([alixClient.address])
  await group.send('hello')

  console.log('created group')
  assert(group instanceof Group, 'group should be a Group')

  await delayToPropogate()

  assert(groupCallbacks === 1, 'group stream should have received 1 group')
  assert(
    messageCallbacks === 1,
    'message stream should have received 1 message'
  )

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
  if (groups.length !== 2) {
    throw Error('Expected group length 2 but it is: ' + groups.length)
  }
  // Sync groups after creation if you created a group
  const listedGroups = await alixClient.conversations.listGroups()
  await delayToPropogate()
  groups.push(listedGroups[listedGroups.length - 1])
  if ((groups.length as number) !== 3) {
    throw Error('Expected group length 3 but it is: ' + groups.length)
  }

  // bo creates a group with caro and then adds alix so a stream callback is fired
  const boCaroGroup = await boClient.conversations.newGroup([
    caroClient.address,
  ])
  await boCaroGroup.addMembers([alixClient.address])
  await delayToPropogate()
  if ((groups.length as number) !== 4) {
    throw Error('Unexpected num groups (should be 4): ' + groups.length)
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
  const first = isIos() ? 1 : 0
  const second = isIos() ? 0 : 1
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

test('can make a group with admin permissions', async () => {
  const [adminClient, anotherClient] = await createClients(2)

  const group = await adminClient.conversations.newGroup(
    [anotherClient.address],
    'admin_only'
  )

  if (group.permissionLevel !== 'admin_only') {
    throw Error(
      `Group permission level should be admin_only but was ${group.permissionLevel}`
    )
  }

  const isAdmin = await group.isAdmin(adminClient.inboxId)
  if (!isAdmin) {
    throw Error(`adminClient should be the admin`)
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

test('can allow a group', async () => {
  const [alix, bo] = await createClients(2)
  const alixGroup = await alix.conversations.newGroup([bo.address])
  const startConsent = await bo.contacts.isGroupAllowed(alixGroup.id)
  if (startConsent) {
    throw Error('Group should not be allowed')
  }
  await bo.contacts.allowGroups([alixGroup.id])
  const isAllowed = await bo.contacts.isGroupAllowed(alixGroup.id)
  if (!isAllowed) {
    throw Error('Group should be allowed')
  }

  return true
})

test('can deny a group', async () => {
  const [alix, bo] = await createClients(2)
  const alixGroup = await alix.conversations.newGroup([bo.address])
  const startConsent = await bo.contacts.isGroupDenied(alixGroup.id)
  if (startConsent) {
    throw Error('Group should be unknown')
  }
  await bo.contacts.denyGroups([alixGroup.id])
  await bo.conversations.syncGroups()
  const boGroups = await bo.conversations.listGroups()
  const isDenied = await bo.contacts.isGroupDenied(alixGroup.id)
  const isGroupDenied = await boGroups[0].isDenied()
  if (!isDenied || !isGroupDenied) {
    throw Error('Group should be denied')
  }
  await bo.contacts.allowGroups([alixGroup.id])
  const isAllowed = await bo.contacts.isGroupAllowed(alixGroup.id)
  if (!isAllowed) {
    throw Error('Group should be allowed')
  }

  return true
})

test('can allow and deny a inbox id', async () => {
  const [alix, bo] = await createClients(2)
  const startConsent = await bo.contacts.isInboxAllowed(alix.inboxId)
  if (startConsent) {
    throw Error('inbox id should be unknown')
  }
  await bo.contacts.denyInboxes([alix.inboxId])
  const isDenied = await bo.contacts.isInboxDenied(alix.inboxId)
  if (!isDenied) {
    throw Error('inbox id should be denied')
  }
  await bo.contacts.allowInboxes([alix.inboxId])
  const isAllowed = await bo.contacts.isInboxAllowed(alix.inboxId)
  if (!isAllowed) {
    throw Error('inbox id should be allowed')
  }

  const consentList = await bo.contacts.consentList()
  assert(
    consentList[0].entryType === 'inbox_id',
    `the message should have a type of inbox_id but was ${consentList[0].entryType}`
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

  assert(groupName === 'New Group', 'group name should be "New Group"')

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

  assert(groupName === 'New Group', 'group name should be "New Group"')

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

// Commenting this out so it doesn't block people, but nice to have?
// test('can stream messages for a long time', async () => {
//   const bo = await Client.createRandom({ env: 'local', enableAlphaMls: true })
//   await delayToPropogate()
//   const alix = await Client.createRandom({ env: 'local', enableAlphaMls: true })
//   await delayToPropogate()
//   const caro = await Client.createRandom({ env: 'local', enableAlphaMls: true })
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
