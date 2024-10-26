import { Wallet } from 'ethers'
import { Platform } from 'expo-modules-core'
import { DecodedMessage } from 'xmtp-react-native-sdk/lib/DecodedMessage'

import {
  Test,
  assert,
  createClients,
  createV3Clients,
  delayToPropogate,
} from './test-utils'
import {
  Client,
  Conversation,
  Dm,
  Group,
  ConversationContainer,
  ConversationVersion,
} from '../../../src/index'

export const conversationTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  conversationTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('can find a conversations by id', async () => {
  const [alixClient, boClient] = await createV3Clients(2)
  const alixGroup = await alixClient.conversations.newGroup([boClient.address])
  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.address)

  await boClient.conversations.syncConversations()
  const boGroup = await boClient.conversations.findConversation(alixGroup.id)
  const boDm = await boClient.conversations.findConversation(alixDm.id)

  assert(
    boGroup?.id === alixGroup.id,
    `bo group id ${boGroup?.id} does not match alix group id ${alixGroup.id}`
  )

  assert(
    boDm?.id === alixDm.id,
    `bo dm id ${boDm?.id} does not match alix dm id ${alixDm.id}`
  )

  return true
})

test('can find a conversation by topic', async () => {
  const [alixClient, boClient] = await createV3Clients(2)
  const alixGroup = await alixClient.conversations.newGroup([boClient.address])
  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.address)

  await boClient.conversations.syncConversations()
  const boGroup = await boClient.conversations.findConversationByTopic(
    alixGroup.topic
  )
  const boDm = await boClient.conversations.findConversationByTopic(
    alixDm.topic
  )

  assert(
    boGroup?.id === alixGroup.id,
    `bo group topic ${boGroup?.id} does not match alix group topic ${alixGroup.id}`
  )

  assert(
    boDm?.id === alixDm.id,
    `bo dm topic ${boDm?.id} does not match alix dm topic ${alixDm.id}`
  )

  return true
})

test('can find a dm by address', async () => {
  const [alixClient, boClient] = await createV3Clients(2)
  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.address)

  await boClient.conversations.syncConversations()
  const boDm = await boClient.conversations.findDm(alixClient.address)

  assert(
    boDm?.id === alixDm.id,
    `bo dm id ${boDm?.id} does not match alix dm id ${alixDm.id}`
  )

  return true
})

test('can stream both conversations and messages at same time', async () => {
  const [alix, bo] = await createV3Clients(2)

  let conversationCallbacks = 0
  let messageCallbacks = 0
  await bo.conversations.streamConversations(async () => {
    conversationCallbacks++
  })

  await bo.conversations.streamAllConversationMessages(async () => {
    messageCallbacks++
  })

  const group = await alix.conversations.newGroup([bo.address])
  const dm = await alix.conversations.findOrCreateDm(bo.address)
  await group.send('hello')
  await dm.send('hello')

  await delayToPropogate()

  assert(
    messageCallbacks === 2,
    'message stream should have received 2 message'
  )
  assert(
    conversationCallbacks === 2,
    'conversation stream should have received 2 conversation'
  )
  return true
})

test('can list conversations with params', async () => {
  const [alixClient, boClient, caroClient] = await createV3Clients(3)

  const boGroup1 = await boClient.conversations.newGroup([alixClient.address])
  const boGroup2 = await boClient.conversations.newGroup([alixClient.address])
  const boDm1 = await boClient.conversations.findOrCreateDm(alixClient.address)
  const boDm2 = await boClient.conversations.findOrCreateDm(caroClient.address)

  await boGroup1.send({ text: `first message` })
  await boGroup1.send({ text: `second message` })
  await boGroup1.send({ text: `third message` })
  await boDm2.send({ text: `third message` })
  await boGroup2.send({ text: `first message` })
  await boDm1.send({ text: `first message` })
  // Order should be [Dm1, Group2, Dm2, Group1]

  const boConvosOrderCreated = await boClient.conversations.listConversations()
  const boConvosOrderLastMessage =
    await boClient.conversations.listConversations(
      { lastMessage: true },
      'lastMessage'
    )
  const boGroupsLimit = await boClient.conversations.listConversations(
    {},
    undefined,
    1
  )

  assert(
    boConvosOrderCreated.map((group: any) => group.id).toString() ===
      [boDm1.id, boGroup2.id, boDm2.id, boGroup1.id].toString(),
    `Conversation order should be group1, group2, dm1, dm2 but was ${boConvosOrderCreated.map((group: any) => group.id).toString()}`
  )

  assert(
    boConvosOrderLastMessage.map((group: any) => group.id).toString() ===
      [boDm1.id, boGroup2.id, boDm2.id, boGroup1.id].toString(),
    `Group order should be dm1, group2, dm2, group1 but was ${boConvosOrderLastMessage.map((group: any) => group.id).toString()}`
  )

  const messages = await boConvosOrderLastMessage[0].messages()
  assert(
    messages[0].content() === 'first message',
    `last message should be first message ${messages[0].content()}`
  )
  assert(
    boConvosOrderLastMessage[0].lastMessage?.content() === 'first message',
    `last message should be last message ${boConvosOrderLastMessage[0].lastMessage?.content()}`
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
  const [alixClient, boClient, caroClient] = await createV3Clients(3)

  const boGroup = await boClient.conversations.newGroup([alixClient.address])
  await boClient.conversations.newGroup([caroClient.address])
  const boDm = await boClient.conversations.findOrCreateDm(caroClient.address)
  await boClient.conversations.findOrCreateDm(alixClient.address)

  const boConversations = await boClient.conversations.listConversations()
  await alixClient.conversations.syncConversations()
  const alixConversations = await alixClient.conversations.listConversations()

  assert(
    boConversations.length === 4,
    `bo conversation lengths should be 4 but was ${boConversations.length}`
  )

  assert(
    alixConversations.length === 3,
    `alix conversation lengths should be 3 but was ${alixConversations.length}`
  )

  if (
    boConversations[0].topic !== boGroup.topic ||
    boConversations[0].version !== ConversationVersion.GROUP ||
    boConversations[2].version !== ConversationVersion.DIRECT ||
    boConversations[2].createdAt !== boDm.createdAt
  ) {
    throw Error('Listed containers should match streamed containers')
  }

  return true
})

test('can stream conversation messages', async () => {
  const [alixClient, boClient] = await createV3Clients(2)

  const alixGroup = await alixClient.conversations.newGroup([boClient.address])
  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.address)
  const alixConversation = await alixClient.conversations.findConversation(
    alixGroup.id
  )

  let dmMessageCallbacks = 0
  let conversationMessageCallbacks = 0
  await alixConversation?.streamMessages(async () => {
    conversationMessageCallbacks++
  })

  await alixDm.streamMessages(async () => {
    dmMessageCallbacks++
  })

  await alixConversation?.send({ text: `first message` })
  await alixDm.send({ text: `first message` })

  return true
})

test('can stream all groups and conversations', async () => {
  const [alixClient, boClient, caroClient] = await createV3Clients(3)

  const containers: ConversationContainer<any>[] = []
  const cancelStreamAll = await alixClient.conversations.streamConversations(
    async (conversation: ConversationContainer<any>) => {
      containers.push(conversation)
    }
  )

  await boClient.conversations.newGroup([alixClient.address])
  await delayToPropogate()
  if ((containers.length as number) !== 1) {
    throw Error(
      'Unexpected num conversations (should be 1): ' + containers.length
    )
  }

  await boClient.conversations.findOrCreateDm(alixClient.address)
  await delayToPropogate()
  if ((containers.length as number) !== 2) {
    throw Error(
      'Unexpected num conversations (should be 2): ' + containers.length
    )
  }

  if (containers[1].version === ConversationVersion.DM) {
    throw Error('Conversation from streamed all should match DM')
  }

  await alixClient.conversations.findOrCreateDm(caroClient.address)
  await delayToPropogate()
  if (containers.length !== 3) {
    throw Error(
      'Expected conversations length 3 but it is: ' + containers.length
    )
  }

  cancelStreamAll()
  await delayToPropogate()

  await caroClient.conversations.newGroup([alixClient.address])
  await delayToPropogate()
  if ((containers.length as number) !== 3) {
    throw Error(
      'Unexpected num conversations (should be 3): ' + containers.length
    )
  }

  return true
})
