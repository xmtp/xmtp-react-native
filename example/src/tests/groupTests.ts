import { DecodedMessage } from 'xmtp-react-native-sdk/lib/DecodedMessage'

import { Test, assert, delayToPropogate, isIos } from './tests'
import {
  Client,
  Conversation,
  Group,
  ConversationContainer,
  ConversationVersion,
} from '../../../src/index'

export const groupTests: Test[] = []

// Function to create a timed promise
function createTimedPromise(timeoutMs: number = 1000): {
  promise: Promise<void>
  resolve: () => void
} {
  let resolve: () => void
  let timeoutHandle: NodeJS.Timeout
  const promise = new Promise<void>((res, reject) => {
    // Assign the resolve function to the outer scoped variable
    resolve = res

    // Set up the timeout
    timeoutHandle = setTimeout(() => {
      reject(new Error('Timeout exceeded'))
    }, timeoutMs)
  })

  // Return the promise and the method to resolve it
  return {
    promise,
    resolve: () => {
      clearTimeout(timeoutHandle)
      resolve()
    },
  }
}

function test(name: string, perform: () => Promise<boolean>) {
  groupTests.push({ name, run: perform })
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

test('can make a MLS V3 client from bundle', async () => {
  const client = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableAlphaMls: true,
  })

  const anotherClient = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableAlphaMls: true,
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
  })

  assert(
    client.address === client2.address,
    `clients dont match ${client2.address} and ${client.address}`
  )

  const randomClient = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableAlphaMls: true,
  })

  const group = await client2.conversations.newGroup([randomClient.address])

  assert(
    group.clientAddress === client2.address,
    `clients dont match ${client2.address} and ${group.clientAddress}`
  )

  return true
})

test('production MLS V3 client creation throws error', async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const client = await Client.createRandom({
      env: 'production',
      appVersion: 'Testing/0.0.0',
      enableAlphaMls: true,
    })
  } catch (error: any) {
    return true
  }
  throw new Error(
    'should throw error on MLS V3 client create when environment is not local'
  )
})

test('can message in a group', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Alice's num groups start at 0
  let aliceGroups = await aliceClient.conversations.listGroups()
  if (aliceGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // Alice creates a group
  const aliceGroup = await aliceClient.conversations.newGroup([
    bobClient.address,
    camClient.address,
  ])

  // Alice's num groups == 1
  aliceGroups = await aliceClient.conversations.listGroups()
  if (aliceGroups.length !== 1) {
    throw new Error('num groups should be 1')
  }

  // Alice group should match create time from list function
  assert(aliceGroups[0].createdAt === aliceGroup.createdAt, 'group create time')

  // Alice can confirm memberAddresses
  const memberAddresses = await aliceGroup.memberAddresses()
  if (memberAddresses.length !== 3) {
    throw new Error('num group members should be 3')
  }
  const lowercasedAddresses: string[] = memberAddresses.map((s) =>
    s.toLowerCase()
  )
  if (
    !(
      lowercasedAddresses.includes(aliceClient.address.toLowerCase()) &&
      lowercasedAddresses.includes(bobClient.address.toLowerCase()) &&
      lowercasedAddresses.includes(camClient.address.toLowerCase())
    )
  ) {
    throw new Error('missing address')
  }

  // Alice can send messages
  await aliceGroup.send('hello, world')
  await aliceGroup.send('gm')

  // Bob's num groups == 1
  const bobGroups = await bobClient.conversations.listGroups()
  if (bobGroups.length !== 1) {
    throw new Error(
      'num groups for bob should be 1, but it is' + bobGroups.length
    )
  }
  delayToPropogate()
  // Bob can read messages from Alice
  const bobMessages: DecodedMessage[] = await bobGroups[0].messages()

  if (bobMessages.length !== 2) {
    throw new Error(
      'num messages for bob should be 2, but it is' + bobMessages.length
    )
  }
  if (bobMessages[0].content() !== 'gm') {
    throw new Error("newest message should be 'gm'")
  }
  if (bobMessages[1].content() !== 'hello, world') {
    throw new Error("newest message should be 'hello, world'")
  }
  // Bob can send a message
  bobGroups[0].send('hey guys!')

  // Cam's num groups == 1
  const camGroups = await camClient.conversations.listGroups()
  if (camGroups.length !== 1) {
    throw new Error(
      'num groups for cam should be 1, but it is' + camGroups.length
    )
  }

  // Cam can read messages from Alice and Bob
  const camMessages = await camGroups[0].messages()
  if (camMessages[1].content() !== 'gm') {
    throw new Error("second Message should be 'gm'")
  }
  if (camMessages[0].content() !== 'hey guys!') {
    throw new Error("newest Message should be 'hey guys!'")
  }

  return true
})

test('can add members to a group', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Alice's num groups start at 0
  let aliceGroups = await aliceClient.conversations.listGroups()
  if (aliceGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // Bob's num groups start at 0
  let bobGroups = await bobClient.conversations.listGroups()
  if (bobGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // Cam's num groups start at 0
  let camGroups = await camClient.conversations.listGroups()
  if (camGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // Alice creates a group
  const aliceGroup = await aliceClient.conversations.newGroup([
    bobClient.address,
  ])

  // Alice's num groups == 1
  aliceGroups = await aliceClient.conversations.listGroups()
  if (aliceGroups.length !== 1) {
    throw new Error('num groups should be 1')
  }

  // Alice can confirm memberAddresses
  const memberAddresses = await aliceGroup.memberAddresses()
  if (memberAddresses.length !== 2) {
    throw new Error('num group members should be 2')
  }
  const lowercasedAddresses: string[] = memberAddresses.map((s) =>
    s.toLowerCase()
  )
  if (
    !(
      lowercasedAddresses.includes(aliceClient.address.toLowerCase()) &&
      lowercasedAddresses.includes(bobClient.address.toLowerCase())
    )
  ) {
    throw new Error('missing address')
  }

  // Alice can send messages
  aliceGroup.send('hello, world')
  aliceGroup.send('gm')

  // Bob's num groups == 1
  bobGroups = await bobClient.conversations.listGroups()
  if (bobGroups.length !== 1) {
    throw new Error(
      'num groups for bob should be 1, but it is' + bobGroups.length
    )
  }

  await aliceGroup.addMembers([camClient.address])

  // Cam's num groups == 1
  camGroups = await camClient.conversations.listGroups()
  if (camGroups.length !== 1) {
    throw new Error(
      'num groups for cam should be 1, but it is' + camGroups.length
    )
  }
  const camMessages = await camGroups[0].messages()
  if (camMessages.length !== 0) {
    throw new Error('num messages for cam should be 0')
  }

  const bobGroupMembers = await bobGroups[0].memberAddresses()
  if (bobGroupMembers.length !== 3) {
    throw new Error('num group members should be 3')
  }

  return true
})

test('can remove members from a group', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Alice's num groups start at 0
  let aliceGroups = await aliceClient.conversations.listGroups()
  if (aliceGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // Bob's num groups start at 0
  let bobGroups = await bobClient.conversations.listGroups()
  assert(bobGroups.length === 0, 'num groups should be 0')

  // Cam's num groups start at 0
  let camGroups = await camClient.conversations.listGroups()
  if (camGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // Alice creates a group
  const aliceGroup = await aliceClient.conversations.newGroup([
    bobClient.address,
    camClient.address,
  ])

  // Alice's num groups == 1
  aliceGroups = await aliceClient.conversations.listGroups()
  if (aliceGroups.length !== 1) {
    throw new Error('num groups should be 1')
  }

  // Alice can confirm memberAddresses
  const memberAddresses = await aliceGroup.memberAddresses()
  if (memberAddresses.length !== 3) {
    throw new Error('num group members should be 3')
  }
  const lowercasedAddresses: string[] = memberAddresses.map((s) =>
    s.toLowerCase()
  )
  if (
    !(
      lowercasedAddresses.includes(aliceClient.address.toLowerCase()) &&
      lowercasedAddresses.includes(bobClient.address.toLowerCase())
    )
  ) {
    throw new Error('missing address')
  }

  // Alice can send messages
  await aliceGroup.send('hello, world')
  await aliceGroup.send('gm')

  // Bob's num groups == 1
  bobGroups = await bobClient.conversations.listGroups()
  if (bobGroups.length !== 1) {
    throw new Error(
      'num groups for bob should be 1, but it is' + bobGroups.length
    )
  }

  // Cam's num groups == 1
  camGroups = await camClient.conversations.listGroups()
  if (camGroups.length !== 1) {
    throw new Error(
      'num groups for cam should be 1, but it is' + camGroups.length
    )
  }

  if (!camGroups[0].isActive()) {
    throw new Error('cams group should be active')
  }

  await aliceGroup.removeMembers([camClient.address])
  const aliceGroupMembers = await aliceGroup.memberAddresses()
  if (aliceGroupMembers.length !== 2) {
    throw new Error('num group members should be 2')
  }

  if (await camGroups[0].isActive()) {
    throw new Error('cams group should not be active')
  }

  const camGroupMembers = await camGroups[0].memberAddresses()
  if (camGroupMembers.length !== 2) {
    throw new Error('num group members should be 2')
  }

  return true
})

test('can stream groups', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Start streaming groups
  const groups: Group<any>[] = []
  const cancelStreamGroups = await aliceClient.conversations.streamGroups(
    async (group: Group<any>) => {
      groups.push(group)
    }
  )

  // Cam creates a group with Alice, so stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const camGroup = await camClient.conversations.newGroup([aliceClient.address])
  await delayToPropogate()
  if ((groups.length as number) !== 1) {
    throw Error('Unexpected num groups (should be 1): ' + groups.length)
  }

  // Bob creates a group with Alice so a stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const bobgroup = await bobClient.conversations.newGroup([aliceClient.address])
  await delayToPropogate()
  if ((groups.length as number) !== 2) {
    throw Error('Unexpected num groups (should be 2): ' + groups.length)
  }

  // * Note Alice creating a group does not trigger alice conversations
  // group stream. Workaround is to syncGroups after you create and list manually
  // See https://github.com/xmtp/libxmtp/issues/504

  // Alice creates a group
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const aliceGroup = await aliceClient.conversations.newGroup([
    bobClient.address,
    camClient.address,
  ])
  await delayToPropogate()
  if (groups.length !== 2) {
    throw Error('Expected group length 2 but it is: ' + groups.length)
  }
  // Sync groups after creation if you created a group
  const listedGroups = await aliceClient.conversations.listGroups()
  await delayToPropogate()
  groups.push(listedGroups[listedGroups.length - 1])
  if ((groups.length as number) !== 3) {
    throw Error('Expected group length 3 but it is: ' + groups.length)
  }

  cancelStreamGroups()
  await delayToPropogate()

  // Creating a group should no longer trigger stream groups
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const camSecond = await camClient.conversations.newGroup([
    aliceClient.address,
  ])
  await delayToPropogate()
  if ((groups.length as number) !== 3) {
    throw Error('Unexpected num groups (should be 3): ' + groups.length)
  }

  return true
})

test('can list all groups and conversations', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Add one group and one conversation
  const bobGroup = await bobClient.conversations.newGroup([aliceClient.address])
  const aliceConversation = await aliceClient.conversations.newConversation(
    camClient.address
  )

  const listedContainers = await aliceClient.conversations.listAll()

  // Verify information in listed containers is correct
  // BUG - List All returns in Chronological order on iOS
  // and reverse Chronological order on Android
  const first = isIos() ? 1 : 0
  const second = isIos() ? 0 : 1
  if (
    listedContainers[first].topic !== bobGroup.topic ||
    listedContainers[first].version !== ConversationVersion.GROUP ||
    listedContainers[second].version !== ConversationVersion.DIRECT ||
    listedContainers[second].createdAt !== aliceConversation.createdAt
  ) {
    throw Error('Listed containers should match streamed containers')
  }

  return true
})

test('can stream all groups and conversations', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Start streaming groups and conversations
  const containers: ConversationContainer<any>[] = []
  const cancelStreamAll = await aliceClient.conversations.streamAll(
    async (conversationContainer: ConversationContainer<any>) => {
      containers.push(conversationContainer)
    }
  )

  // Bob creates a group with Alice, so stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const bobGroup = await bobClient.conversations.newGroup([aliceClient.address])
  await delayToPropogate()
  if ((containers.length as number) !== 1) {
    throw Error('Unexpected num groups (should be 1): ' + containers.length)
  }

  // Bob creates a v2 Conversation with Alice so a stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const bobConversation = await bobClient.conversations.newConversation(
    aliceClient.address
  )
  await delayToPropogate()
  if ((containers.length as number) !== 2) {
    throw Error('Unexpected num groups (should be 2): ' + containers.length)
  }

  if (
    containers[1].version === ConversationVersion.DIRECT &&
    bobConversation.conversationID !==
      (containers[1] as Conversation<any>).conversationID
  ) {
    throw Error(
      'Conversation from streamed all should match conversationID with created conversation'
    )
  }

  // * Note Alice creating a v2 Conversation does trigger alice conversations
  // stream.

  // Alice creates a V2 Conversationgroup
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const aliceConversation = await aliceClient.conversations.newConversation(
    camClient.address
  )
  await delayToPropogate()
  if (containers.length !== 3) {
    throw Error('Expected group length 3 but it is: ' + containers.length)
  }

  cancelStreamAll()
  await delayToPropogate()

  // Creating a group should no longer trigger stream groups
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const camConversation = await camClient.conversations.newGroup([
    aliceClient.address,
  ])
  await delayToPropogate()
  if ((containers.length as number) !== 3) {
    throw Error('Unexpected num groups (should be 3): ' + containers.length)
  }

  return true
})

test('canMessage', async () => {
  const bo = await Client.createRandom({ env: 'local' })
  const alix = await Client.createRandom({ env: 'local' })

  const canMessage = await bo.canMessage(alix.address)
  if (!canMessage) {
    throw new Error('should be able to message v2 client')
  }

  const caro = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const chux = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  const canMessageV3 = await caro.canGroupMessage([chux.address])
  if (!canMessageV3) {
    throw new Error('should be able to message v3 client')
  }
  return true
})

test('can stream group messages', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Alice creates a group
  const aliceGroup = await aliceClient.conversations.newGroup([
    bobClient.address,
    camClient.address,
  ])

  // Record message stream for this group
  const groupMessages: DecodedMessage[] = []
  const cancelGroupMessageStream = await aliceGroup.streamGroupMessages(
    async (message) => {
      groupMessages.push(message)
    }
  )

  // Bob's num groups == 1
  const bobGroup = (await bobClient.conversations.listGroups())[0]

  for (let i = 0; i < 5; i++) {
    await bobGroup.send({ text: `Message ${i}` })
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
    await bobGroup.send({ text: `Message ${i}` })
  }

  if (groupMessages.length !== 5) {
    throw Error('Unexpected convo messages count ' + groupMessages.length)
  }

  return true
})

test('can stream all messages', async () => {
  const bo = await Client.createRandom({ env: 'local', enableAlphaMls: true })
  await delayToPropogate()
  const alix = await Client.createRandom({ env: 'local', enableAlphaMls: true })
  await delayToPropogate()

  // Record message stream across all conversations
  const allMessages: DecodedMessage[] = []
  await alix.conversations.streamAllMessages(async (message) => {
    allMessages.push(message)
  })

  // Start Bob starts a new conversation.
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

  // Starts a new conversation.
  const caro = await Client.createRandom({ env: 'local', enableAlphaMls: true })
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
  const adminClient = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableAlphaMls: true,
  })

  const anotherClient = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableAlphaMls: true,
  })

  const group = await adminClient.conversations.newGroup(
    [anotherClient.address],
    'creator_admin'
  )

  if (group.permissionLevel !== 'creator_admin') {
    throw Error(
      `Group permission level should be creator_admin but was ${group.permissionLevel}`
    )
  }

  const isAdmin = await group.isAdmin()
  if (!isAdmin) {
    throw Error(`adminClient should be the admin`)
  }

  if (group.adminAddress.toLowerCase !== adminClient.address.toLowerCase) {
    throw Error(`adminClient should be the admin but was ${group.adminAddress}`)
  }

  return true
})

test('can paginate group messages', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Alice creates a group
  const aliceGroup = await aliceClient.conversations.newGroup([
    bobClient.address,
  ])

  // Alice can send messages
  await aliceGroup.send('hello, world')
  await aliceGroup.send('gm')

  const bobGroups = await bobClient.conversations.listGroups()
  if (bobGroups.length !== 1) {
    throw new Error(
      'num groups for bob should be 1, but it is' + bobGroups.length
    )
  }
  delayToPropogate()
  // Bob can read messages from Alice
  const bobMessages: DecodedMessage[] = await bobGroups[0].messages(false, 1)

  if (bobMessages.length !== 1) {
    throw Error(`Should limit just 1 message but was ${bobMessages.length}`)
  }

  return true
})

test('can stream all group messages', async () => {
  const bo = await Client.createRandom({ env: 'local', enableAlphaMls: true })
  await delayToPropogate()
  const alix = await Client.createRandom({ env: 'local', enableAlphaMls: true })
  await delayToPropogate()

  // Start Bob starts a new group.
  const boGroup = await bo.conversations.newGroup([alix.address])
  await delayToPropogate()

  // Starts a new conversation.
  const caro = await Client.createRandom({ env: 'local', enableAlphaMls: true })
  const caroGroup = await caro.conversations.newGroup([alix.address])

  // Record message stream across all conversations
  const allMessages: DecodedMessage[] = []
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

test('group message send returns groupId', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Alice creates a group
  const aliceGroup = await aliceClient.conversations.newGroup([
    bobClient.address,
    camClient.address,
  ])

  // Alice starts streaming messages for this group
  const groupMessages: DecodedMessage[] = []
  let messageCount = 0
  const startTime: Record<number, number> = {}

  const firstMessageReceived = createTimedPromise()
  const secondMessageReceived = createTimedPromise()

  const cancelGroupMessageStream = await aliceGroup.streamGroupMessages(
    async (message) => {
      messageCount++
      const endTime = Date.now()
      const duration = endTime - startTime[messageCount]
      console.log(
        `Message ${messageCount} streamed after ${duration} milliseconds.`
      )
      groupMessages.push(message)

      if (message.content() === 'hello') {
        firstMessageReceived.resolve()
      } else if (message.content() === 'world') {
        secondMessageReceived.resolve()
      }
    }
  )

  const sendMessage = async (
    group: typeof aliceGroup,
    text: string,
    index: number
  ): Promise<string> => {
    startTime[index] = Date.now()
    return group.send({ text })
  }

  // Bob sends a message
  const bobGroup = (await bobClient.conversations.listGroups())[0]
  assert(bobGroup.id === aliceGroup.id, 'Expected group id to match')
  const bobMessageSentId = await sendMessage(bobGroup, 'hello', 1)

  // Wait for the first message to be streamed
  await firstMessageReceived.promise

  // Cam sends a message
  const camGroup = (await camClient.conversations.listGroups())[0]
  const camMessageSentId = await sendMessage(camGroup, 'world', 2)

  // Wait for the second message to be streamed
  await secondMessageReceived.promise

  // Id returned from message.send is the group id
  assert(
    bobMessageSentId === aliceGroup.id,
    'Expected message send to return group id'
  )
  assert(
    camMessageSentId === aliceGroup.id,
    'Expected message send to return group id'
  )
  console.log('aliceGroup.id', aliceGroup.id)

  // Stream Messages have their own unique ids not equal to groupID
  assert(
    groupMessages.length === 2,
    'Expected 2 messages, but got ' + groupMessages.length
  )
  assert(
    groupMessages[0].id !== aliceGroup.id,
    'Expected message id to not match group id'
  )
  console.log('groupMessages[0].id', groupMessages[0].id)
  assert(
    groupMessages[1].id !== aliceGroup.id,
    'Expected message id to not match group id'
  )
  console.log('groupMessages[1].id', groupMessages[1].id)

  cancelGroupMessageStream()

  return true
})

test('conversation message send returns message id', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Alice creates a group
  const aliceConversation = await aliceClient.conversations.newConversation(
    bobClient.address
  )

  // Alice starts streaming messages for this group
  const conversationMessages: DecodedMessage[] = []
  const cancelGroupMessageStream = await aliceConversation.streamMessages(
    async (message) => {
      conversationMessages.push(message)
    }
  )

  // Bob sends a message
  const bobConversation = (await bobClient.conversations.list())[0]
  assert(
    bobConversation.topic === aliceConversation.topic,
    'Expected group id to match'
  )
  const bobMessageSentId = await bobConversation.send({ text: 'hello' })

  // Id returned from message.send is the group id
  assert(
    bobMessageSentId !== bobConversation.topic,
    'Expected message send to return group id'
  )

  cancelGroupMessageStream()

  return true
})
