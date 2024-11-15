import { Test, assert, createClients, delayToPropogate } from './test-utils'
import { Conversation } from '../../../src/index'

export const dmTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  dmTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('can filter dms by consent', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  await boClient.conversations.newGroup([alixClient.address])
  const otherGroup = await alixClient.conversations.newGroup([boClient.address])
  const boDm1 = await boClient.conversations.findOrCreateDm(alixClient.address)
  await caroClient.conversations.findOrCreateDm(boClient.address)
  await boClient.conversations.sync
  const boDm2 = await boClient.conversations.findDmByInboxId(caroClient.inboxId)
  await boClient.conversations.findGroup(otherGroup.id)

  const boConvos = await boClient.conversations.listDms()
  const boConvosFilteredAllowed = await boClient.conversations.listDms(
    {},
    undefined,
    undefined,
    'allowed'
  )
  const boConvosFilteredUnknown = await boClient.conversations.listDms(
    {},
    undefined,
    undefined,
    'unknown'
  )

  assert(
    boConvos.length === 2,
    `Conversation length should be 2 but was ${boConvos.length}`
  )

  assert(
    boConvosFilteredAllowed
      .map((conversation: any) => conversation.id)
      .toString() === [boDm1.id].toString(),
    `Conversation allowed should be ${[
      boDm1.id,
    ].toString()} but was ${boConvosFilteredAllowed
      .map((convo: any) => convo.id)
      .toString()}`
  )

  assert(
    boConvosFilteredUnknown
      .map((conversation: any) => conversation.id)
      .toString() === [boDm2?.id].toString(),
    `Conversation unknown filter should be ${[
      boDm2?.id,
    ].toString()} but was ${boConvosFilteredUnknown
      .map((convo: any) => convo.id)
      .toString()}`
  )

  return true
})

test('can list dms with params', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  const boGroup1 = await boClient.conversations.newGroup([alixClient.address])
  const boGroup2 = await boClient.conversations.newGroup([alixClient.address])
  const boDm1 = await boClient.conversations.findOrCreateDm(alixClient.address)
  const boDm2 = await boClient.conversations.findOrCreateDm(caroClient.address)

  await boGroup1.send({ text: `first message` })
  await boGroup1.send({ text: `second message` })
  await boGroup1.send({ text: `third message` })
  await boDm2.send({ text: `third message` })
  await boGroup2.send({ text: `first message` })
  await boDm1.send({ text: `dm message` })

  await boClient.conversations.syncAllConversations()
  const boConvosOrderCreated = await boClient.conversations.listDms()
  const boConvosOrderLastMessage = await boClient.conversations.listDms(
    { lastMessage: true },
    'lastMessage'
  )
  const boDmsLimit = await boClient.conversations.listDms({}, undefined, 1)

  assert(
    boConvosOrderCreated
      .map((conversation: any) => conversation.id)
      .toString() === [boDm1.id, boDm2.id].toString(),
    `Conversation created at order should be ${[
      boDm1.id,
      boDm2.id,
    ].toString()} but was ${boConvosOrderCreated
      .map((convo: any) => convo.id)
      .toString()}`
  )

  assert(
    boConvosOrderLastMessage
      .map((conversation: any) => conversation.id)
      .toString() === [boDm1.id, boDm2.id].toString(),
    `Conversation last message order should be ${[
      boDm1.id,
      boDm2.id,
    ].toString()} but was ${boConvosOrderLastMessage
      .map((convo: any) => convo.id)
      .toString()}`
  )

  const messages = await boConvosOrderLastMessage[0].messages()
  assert(
    messages[0].content() === 'dm message',
    `last message 1 should be dm message ${messages[0].content()}`
  )

  assert(
    boDmsLimit[0].id === boDm1.id,
    `Dms limit should be ${boDm1.id} but was ${boDmsLimit[0].id}`
  )

  return true
})

test('can stream all dm messages', async () => {
  const [alix, bo] = await createClients(2)

  let conversationCallbacks = 0
  let messageCallbacks = 0
  await bo.conversations.stream(async () => {
    conversationCallbacks++
  }, 'dms')

  await bo.conversations.streamAllMessages(async () => {
    messageCallbacks++
  }, 'dms')

  const group = await alix.conversations.newGroup([bo.address])
  const dm = await alix.conversations.findOrCreateDm(bo.address)
  await delayToPropogate()
  await group.send('hello')
  await dm.send('hello')
  await delayToPropogate()

  assert(
    conversationCallbacks === 1,
    'conversation stream should have received 1 conversation'
  )
  assert(
    messageCallbacks === 1,
    'message stream should have received 1 message'
  )

  return true
})

test('can stream dm messages', async () => {
  const [alixClient, boClient] = await createClients(2)

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

  assert(
    conversationMessageCallbacks === 1,
    'conversation stream should have received 1 conversation'
  )
  assert(
    dmMessageCallbacks === 1,
    'message stream should have received 1 message'
  )

  return true
})

test('can stream all dms', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  const containers: Conversation<any>[] = []
  await alixClient.conversations.stream(
    async (conversation: Conversation<any>) => {
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

  await alixClient.conversations.findOrCreateDm(caroClient.address)
  await delayToPropogate()
  if (containers.length !== 3) {
    throw Error(
      'Expected conversations length 3 but it is: ' + containers.length
    )
  }

  alixClient.conversations.cancelStream()
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
