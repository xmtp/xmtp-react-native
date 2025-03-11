import { content } from '@xmtp/proto'
import { Wallet } from 'ethers'
import RNFS from 'react-native-fs'
import { PreferenceUpdates } from 'xmtp-react-native-sdk/lib/PrivatePreferences'

import {
  Test,
  assert,
  createClients,
  delayToPropogate,
  adaptEthersWalletToSigner,
  assertEqual,
} from './test-utils'
import {
  Client,
  ConsentRecord,
  Conversation,
  ConversationId,
  ConversationVersion,
  JSContentCodec,
} from '../../../src/index'

export const conversationTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  conversationTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

type EncodedContent = content.EncodedContent
type ContentTypeId = content.ContentTypeId

const ContentTypeNumber: ContentTypeId = {
  authorityId: 'org',
  typeId: 'number',
  versionMajor: 1,
  versionMinor: 0,
}

const ContentTypeNumberWithUndefinedFallback: ContentTypeId = {
  authorityId: 'org',
  typeId: 'number_undefined_fallback',
  versionMajor: 1,
  versionMinor: 0,
}

const ContentTypeNumberWithEmptyFallback: ContentTypeId = {
  authorityId: 'org',
  typeId: 'number_empty_fallback',
  versionMajor: 1,
  versionMinor: 0,
}

export type NumberRef = {
  topNumber: {
    bottomNumber: number
  }
}

class NumberCodec implements JSContentCodec<NumberRef> {
  contentType = ContentTypeNumber

  // a completely absurd way of encoding number values
  encode(content: NumberRef): EncodedContent {
    return {
      type: ContentTypeNumber,
      parameters: {
        test: 'test',
      },
      content: new TextEncoder().encode(JSON.stringify(content)),
    }
  }

  decode(encodedContent: EncodedContent): NumberRef {
    if (encodedContent.parameters.test !== 'test') {
      throw new Error(`parameters should parse ${encodedContent.parameters}`)
    }
    const contentReceived = JSON.parse(
      new TextDecoder().decode(encodedContent.content)
    ) as NumberRef
    return contentReceived
  }

  fallback(content: NumberRef): string | undefined {
    return 'a billion'
  }
}

class NumberCodecUndefinedFallback extends NumberCodec {
  contentType = ContentTypeNumberWithUndefinedFallback
  fallback(content: NumberRef): string | undefined {
    return undefined
  }
}

class NumberCodecEmptyFallback extends NumberCodec {
  contentType = ContentTypeNumberWithEmptyFallback
  fallback(content: NumberRef): string | undefined {
    return ''
  }
}

test('register and use custom content types', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const bo = await Client.createRandom({
    env: 'local',
    codecs: [new NumberCodec()],
    dbEncryptionKey: keyBytes,
  })
  const alix = await Client.createRandom({
    env: 'local',
    codecs: [new NumberCodec()],
    dbEncryptionKey: keyBytes,
  })

  Client.register(new NumberCodec())

  await delayToPropogate()

  const boConvo = await bo.conversations.newConversation(alix.inboxId)
  await delayToPropogate()
  await boConvo.send(
    { topNumber: { bottomNumber: 12 } },
    { contentType: ContentTypeNumber }
  )

  await alix.conversations.syncAllConversations()
  const alixConvo = await alix.conversations.findConversation(boConvo.id)

  const messages = await alixConvo!.messages()
  assert(messages.length === 1, 'did not get messages')

  const message = messages[0]
  const messageContent = message.content()

  assert(
    typeof messageContent === 'object' &&
      'topNumber' in messageContent &&
      messageContent.topNumber.bottomNumber === 12,
    'did not get content properly: ' + JSON.stringify(messageContent)
  )

  return true
})

test('register and use custom content types with prepare', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const bo = await Client.createRandom({
    env: 'local',
    codecs: [new NumberCodec()],
    dbEncryptionKey: keyBytes,
  })
  const alix = await Client.createRandom({
    env: 'local',
    codecs: [new NumberCodec()],
    dbEncryptionKey: keyBytes,
  })

  Client.register(new NumberCodec())

  await delayToPropogate()

  const boConvo = await bo.conversations.newConversation(alix.inboxId)
  await delayToPropogate()
  await boConvo.prepareMessage(
    { topNumber: { bottomNumber: 12 } },
    { contentType: ContentTypeNumber }
  )
  await boConvo.publishPreparedMessages()

  await alix.conversations.syncAllConversations()
  const alixConvo = await alix.conversations.findConversation(boConvo.id)

  const messages = await alixConvo!.messages()
  assert(messages.length === 1, 'did not get messages')

  const message = messages[0]
  const messageContent = message.content()

  assert(
    typeof messageContent === 'object' &&
      'topNumber' in messageContent &&
      messageContent.topNumber.bottomNumber === 12,
    'did not get content properly: ' + JSON.stringify(messageContent)
  )

  return true
})

test('handle fallback types appropriately', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const bob = await Client.createRandom({
    env: 'local',
    codecs: [
      new NumberCodecEmptyFallback(),
      new NumberCodecUndefinedFallback(),
    ],
    dbEncryptionKey: keyBytes,
  })
  const alix = await Client.createRandom({
    env: 'local',
    dbEncryptionKey: keyBytes,
  })
  Client.register(new NumberCodecEmptyFallback())
  Client.register(new NumberCodecUndefinedFallback())
  const bobConvo = await bob.conversations.newConversation(alix.inboxId)

  // @ts-ignore
  await bobConvo.send(12, { contentType: ContentTypeNumberWithEmptyFallback })

  // @ts-ignore
  await bobConvo.send(12, {
    contentType: ContentTypeNumberWithUndefinedFallback,
  })

  await alix.conversations.syncAllConversations()
  const aliceConvo = await alix.conversations.findConversation(bobConvo.id)

  const messages = await aliceConvo!.messages()
  assert(messages.length === 2, 'did not get messages')

  const messageUndefinedFallback = messages[0]
  const messageWithDefinedFallback = messages[1]

  let message1Content = undefined
  try {
    message1Content = messageUndefinedFallback.content()
  } catch {
    message1Content = messageUndefinedFallback.fallback
  }

  assert(
    message1Content === undefined,
    'did not get content properly when empty fallback: ' +
      JSON.stringify(message1Content)
  )

  let message2Content = undefined
  try {
    message2Content = messageWithDefinedFallback.content()
  } catch {
    message2Content = messageWithDefinedFallback.fallback
  }

  assert(
    message2Content === '',
    'did not get content properly: ' + JSON.stringify(message2Content)
  )

  return true
})

test('can find a conversations by id', async () => {
  const [alixClient, boClient] = await createClients(2)
  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])
  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.inboxId)

  await boClient.conversations.sync()
  const boGroup = await boClient.conversations.findConversation(alixGroup.id)
  const boDm = await boClient.conversations.findConversation(alixDm.id)
  const boDm2 = await boClient.conversations.findConversation(
    'GARBAGE' as ConversationId
  )

  assert(boDm2 === undefined, `bodm2 should be undefined`)

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
  const [alixClient, boClient] = await createClients(2)
  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])
  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.inboxId)

  await boClient.conversations.sync()
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

test('can find a dm by inbox id', async () => {
  const [alixClient, boClient] = await createClients(2)
  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.inboxId)

  await boClient.conversations.sync()
  const boDm = await boClient.conversations.findDmByInboxId(alixClient.inboxId)

  assert(
    boDm?.id === alixDm.id,
    `bo dm id ${boDm?.id} does not match alix dm id ${alixDm.id}`
  )

  return true
})

test('can find a dm by address', async () => {
  const [alixClient, boClient] = await createClients(2)
  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.inboxId)

  await boClient.conversations.sync()
  const boDm = await boClient.conversations.findDmByIdentity(
    alixClient.publicIdentity
  )

  assert(
    boDm?.id === alixDm.id,
    `bo dm id ${boDm?.id} does not match alix dm id ${alixDm.id}`
  )

  return true
})

test('can filter conversations by consent', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  // Bo allowed + 1
  const boGroupWithAlixAllowed = await boClient.conversations.newGroup([
    alixClient.inboxId,
  ])
  // Bo unknown + 1
  const alixGroupWithBo = await alixClient.conversations.newGroup([
    boClient.inboxId,
  ])
  // Bo allowed + 1
  const boDmWithAlixAllowed = await boClient.conversations.findOrCreateDm(
    alixClient.inboxId
  )
  // Bo unknown + 1
  await caroClient.conversations.findOrCreateDm(boClient.inboxId)
  await boClient.conversations.sync()
  const boDmWithCaroUnknownThenDenied =
    await boClient.conversations.findDmByInboxId(caroClient.inboxId)
  const boGroupWithAlixUnknown = await boClient.conversations.findGroup(
    alixGroupWithBo.id
  )

  // Bo denied + 1; Bo unknown - 1
  await boDmWithCaroUnknownThenDenied?.updateConsent('denied')

  const boConvos = await boClient.conversations.list()
  const boConvosFilteredAllowed = await boClient.conversations.list(
    {},
    undefined,
    ['allowed']
  )
  const boConvosFilteredUnknown = await boClient.conversations.list(
    {},
    undefined,
    ['unknown']
  )
  const boConvosFilteredAllowedOrDenied = await boClient.conversations.list(
    {},
    undefined,
    ['allowed', 'denied']
  )

  assert(
    boConvos.length === 4,
    `Conversation length should be 4 but was ${boConvos.length}`
  )

  assert(
    boConvosFilteredAllowed
      .map((conversation: any) => conversation.id)
      .toString() ===
      [boGroupWithAlixAllowed.id, boDmWithAlixAllowed.id].toString(),
    `Conversation allowed should be ${[
      boGroupWithAlixAllowed.id,
      boDmWithAlixAllowed.id,
    ].toString()} but was ${boConvosFilteredAllowed
      .map((convo: any) => convo.id)
      .toString()}`
  )

  assert(
    boConvosFilteredUnknown
      .map((conversation: any) => conversation.id)
      .toString() === [boGroupWithAlixUnknown?.id].toString(),
    `Conversation unknown filter should be ${[
      boGroupWithAlixUnknown?.id,
    ].toString()} but was ${boConvosFilteredUnknown
      .map((convo: any) => convo.id)
      .toString()}`
  )

  assert(
    boConvosFilteredAllowedOrDenied
      .map((conversation: any) => conversation.id)
      .toString() ===
      [
        boGroupWithAlixAllowed.id,
        boDmWithAlixAllowed.id,
        boDmWithCaroUnknownThenDenied?.id,
      ].toString(),
    `Conversation allowed or denied filter should be ${[
      boGroupWithAlixAllowed.id,
      boDmWithAlixAllowed.id,
      boDmWithCaroUnknownThenDenied?.id,
    ].toString()} but was ${boConvosFilteredAllowedOrDenied
      .map((convo: any) => convo.id)
      .toString()}`
  )

  return true
})

test('can filter sync all by consent', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  // Bo allowed + 1
  await boClient.conversations.newGroup([alixClient.inboxId])
  // Bo unknown + 1
  const otherGroup = await alixClient.conversations.newGroup([boClient.inboxId])
  // Bo allowed + 1
  await boClient.conversations.findOrCreateDm(alixClient.inboxId)
  // Bo unknown + 1
  await caroClient.conversations.findOrCreateDm(boClient.inboxId)

  await boClient.conversations.sync()
  const boDmWithCaro = await boClient.conversations.findDmByInboxId(
    caroClient.inboxId
  )
  await boClient.conversations.findGroup(otherGroup.id)

  // Bo denied + 1; Bo unknown - 1
  await boDmWithCaro?.updateConsent('denied')

  const boConvos = await boClient.conversations.syncAllConversations()
  const boConvosFilteredAllowed =
    await boClient.conversations.syncAllConversations(['allowed'])
  const boConvosFilteredUnknown =
    await boClient.conversations.syncAllConversations(['unknown'])

  const boConvosFilteredAllowedOrDenied =
    await boClient.conversations.syncAllConversations(['allowed', 'denied'])

  assert(boConvos === 5, `Conversation length should be 5 but was ${boConvos}`)
  assert(
    boConvosFilteredAllowed === 3,
    `Conversation length should be 3 but was ${boConvosFilteredAllowed}`
  )
  assert(
    boConvosFilteredUnknown === 2,
    `Conversation length should be 2 but was ${boConvosFilteredUnknown}`
  )

  assert(
    boConvosFilteredAllowedOrDenied === 4,
    `Conversation length should be 4 but was ${boConvosFilteredAllowedOrDenied}`
  )

  return true
})

test('can list conversations with params', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  const boGroup1 = await boClient.conversations.newGroup([alixClient.inboxId])
  const boGroup2 = await boClient.conversations.newGroup([alixClient.inboxId])
  const boDm1 = await boClient.conversations.findOrCreateDm(alixClient.inboxId)
  const boDm2 = await boClient.conversations.findOrCreateDm(caroClient.inboxId)

  await boGroup1.send({ text: `first message` })
  await boGroup1.send({ text: `second message` })
  await boGroup1.send({ text: `third message` })
  await boDm2.send({ text: `third message` })
  await boGroup2.send({ text: `first message` })
  await boDm1.send({ text: `dm message` })
  // Order should be [Dm1, Group2, Dm2, Group1]

  await boClient.conversations.syncAllConversations()
  const boConvosOrderLastMessage = await boClient.conversations.list({
    lastMessage: true,
  })
  const boGroupsLimit = await boClient.conversations.list({}, 1)

  assert(
    boConvosOrderLastMessage.map((group: any) => group.id).toString() ===
      [boDm1.id, boGroup2.id, boDm2.id, boGroup1.id].toString(),
    `Conversation last message order should be ${[
      boDm1.id,
      boGroup2.id,
      boDm2.id,
      boGroup1.id,
    ].toString()} but was ${boConvosOrderLastMessage
      .map((group: any) => group.id)
      .toString()}`
  )

  const messages = await boConvosOrderLastMessage[0].messages()
  assert(
    messages[0].content() === 'dm message',
    `last message 1 should be dm message ${messages[0].content()}`
  )
  assert(
    boConvosOrderLastMessage[0].lastMessage?.content() === 'dm message',
    `last message 2 should be dm message ${boConvosOrderLastMessage[0].lastMessage?.content()}`
  )
  assert(
    boGroupsLimit.length === 1,
    `List length should be 1 but was ${boGroupsLimit.length}`
  )
  assert(
    boGroupsLimit[0].id === boDm1.id,
    `Group should be ${boDm1.id} but was ${boGroupsLimit[0].id}`
  )

  return true
})

test('can list groups', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  const boGroup = await boClient.conversations.newGroup([alixClient.inboxId])
  await boClient.conversations.newGroup([
    caroClient.inboxId,
    alixClient.inboxId,
  ])
  await boClient.conversations.findOrCreateDm(caroClient.inboxId)
  const boDm = await boClient.conversations.findOrCreateDm(alixClient.inboxId)

  const boConversations = await boClient.conversations.list()
  await alixClient.conversations.sync()
  const alixConversations = await alixClient.conversations.list()

  assert(
    boConversations.length === 4,
    `bo conversation lengths should be 4 but was ${boConversations.length}`
  )

  assert(
    alixConversations.length === 3,
    `alix conversation lengths should be 3 but was ${alixConversations.length}`
  )

  if (
    boConversations[3].topic !== boGroup.topic ||
    boConversations[3].version !== ConversationVersion.GROUP ||
    boConversations[0].version !== ConversationVersion.DM ||
    boConversations[0].createdAt !== boDm.createdAt
  ) {
    throw Error('Listed containers should match streamed containers')
  }

  return true
})

test('can list conversation messages', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  const boGroup = await boClient.conversations.newGroup([alixClient.inboxId])
  const boDm = await boClient.conversations.findOrCreateDm(caroClient.inboxId)
  const boGroupConversation = await boClient.conversations.findConversation(
    boGroup.id
  )
  const boDmConversation = await boClient.conversations.findConversation(
    boDm.id
  )

  await boGroupConversation?.send('hello')
  await boGroupConversation?.send('hello')
  await boDmConversation?.send('hello')
  await boDmConversation?.send('hello')

  const boGroupMessages = await boGroupConversation?.messages()
  const boDmMessages = await boDmConversation?.messages()

  assert(
    boGroupMessages?.length === 3,
    `bo conversation lengths should be 3 but was ${boGroupMessages?.length}`
  )

  assert(
    boDmMessages?.length === 3,
    `alix conversation lengths should be 3 but was ${boDmMessages?.length}`
  )

  return true
})

test('can stream both conversations and messages at same time', async () => {
  const [alix, bo] = await createClients(2)

  let conversationCallbacks = 0
  let messageCallbacks = 0
  await bo.conversations.stream(async () => {
    conversationCallbacks++
  })

  await bo.conversations.streamAllMessages(async () => {
    messageCallbacks++
  })

  const group = await alix.conversations.newGroup([bo.inboxId])
  const dm = await alix.conversations.findOrCreateDm(bo.inboxId)
  await delayToPropogate()
  await group.send('hello')
  await dm.send('hello')
  await delayToPropogate()

  assert(
    conversationCallbacks === 2,
    'conversation stream should have received 2 conversation'
  )
  assert(
    messageCallbacks === 2,
    'message stream should have received 2 message'
  )

  bo.conversations.cancelStreamAllMessages()
  return true
})

test('can stream conversation messages', async () => {
  const [alixClient, boClient] = await createClients(2)

  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])
  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.inboxId)
  const alixGroupConversation = await alixClient.conversations.findConversation(
    alixGroup.id
  )
  const alixDmConversation = await alixClient.conversations.findConversation(
    alixDm.id
  )

  let dmMessageCallbacks = 0
  let conversationMessageCallbacks = 0
  await alixGroupConversation?.streamMessages(async () => {
    conversationMessageCallbacks++
  })

  await alixDmConversation?.streamMessages(async () => {
    dmMessageCallbacks++
  })

  await alixGroupConversation?.send({ text: `first message` })
  await alixDmConversation?.send({ text: `first message` })

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

test('can stream all groups and conversations', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  const containers: Conversation<any>[] = []
  await alixClient.conversations.stream(
    async (conversation: Conversation<any>) => {
      containers.push(conversation)
    }
  )

  await boClient.conversations.newGroup([alixClient.inboxId])
  await delayToPropogate()
  if ((containers.length as number) !== 1) {
    throw Error(
      'Unexpected num conversations (should be 1): ' + containers.length
    )
  }

  await boClient.conversations.findOrCreateDm(alixClient.inboxId)
  await delayToPropogate()
  if ((containers.length as number) !== 2) {
    throw Error(
      'Unexpected num conversations (should be 2): ' + containers.length
    )
  }

  await alixClient.conversations.findOrCreateDm(caroClient.inboxId)
  await delayToPropogate()
  if (containers.length !== 3) {
    throw Error(
      'Expected conversations length 3 but it is: ' + containers.length
    )
  }

  alixClient.conversations.cancelStream()
  await delayToPropogate()

  await caroClient.conversations.newGroup([alixClient.inboxId])
  await delayToPropogate()
  if ((containers.length as number) !== 3) {
    throw Error(
      'Unexpected num conversations (should be 3): ' + containers.length
    )
  }

  return true
})

test('can streamAll from multiple clients', async () => {
  const [alix, bo, caro] = await createClients(3)

  // Setup stream alls
  const allBoConversations: any[] = []
  const allAliConversations: any[] = []

  await bo.conversations.stream(async (conversation) => {
    allBoConversations.push(conversation)
  })
  await alix.conversations.stream(async (conversation) => {
    allAliConversations.push(conversation)
  })

  // Start Caro starts a new conversation.
  await caro.conversations.newConversation(alix.inboxId)
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

  await alix.conversations.stream(async (conversation) => {
    allAliConversations.push(conversation)
  })

  await bo.conversations.stream(async (conversation) => {
    allBoConversations.push(conversation)
  })

  // Start Caro starts a new conversation.
  await caro.conversations.newConversation(alix.inboxId)
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
  })
  await alix.conversations.streamAllMessages(async (conversation) => {
    allAliMessages.push(conversation)
  })

  // Start Caro starts a new conversation.
  const caroConversation = await caro.conversations.newConversation(
    alix.inboxId
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

  bo.conversations.cancelStreamAllMessages()
  alix.conversations.cancelStreamAllMessages()
  return true
})

test('can streamAllMessages from multiple clients - swapped', async () => {
  const [alix, bo, caro] = await createClients(3)

  // Setup stream
  const allBoMessages: any[] = []
  const allAliMessages: any[] = []
  const caroGroup = await caro.conversations.newGroup([alix.inboxId])

  await alix.conversations.streamAllMessages(async (conversation) => {
    allAliMessages.push(conversation)
  })
  await bo.conversations.streamAllMessages(async (conversation) => {
    allBoMessages.push(conversation)
  })

  // Start Caro starts a new conversation.
  const caroConvo = await caro.conversations.newConversation(alix.inboxId)
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
  bo.conversations.cancelStreamAllMessages()
  alix.conversations.cancelStreamAllMessages()

  return true
})

test('can sync consent (expected to fail unless historySyncUrl is set)', async () => {
  const [bo] = await createClients(1)
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dbDirPath = `${RNFS.DocumentDirectoryPath}/xmtp_db`
  const dbDirPath2 = `${RNFS.DocumentDirectoryPath}/xmtp_db2`
  const directoryExists = await RNFS.exists(dbDirPath)
  if (!directoryExists) {
    await RNFS.mkdir(dbDirPath)
  }
  const directoryExists2 = await RNFS.exists(dbDirPath2)
  if (!directoryExists2) {
    await RNFS.mkdir(dbDirPath2)
  }
  const alixWallet = Wallet.createRandom()

  const alix = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath,
    historySyncUrl: 'http://10.0.2.2:5558',
  })

  // Create DM conversation
  const dm = await alix.conversations.findOrCreateDm(bo.inboxId)
  await dm.updateConsent('denied')
  const consentState = await dm.consentState()
  assert(consentState === 'denied', `Expected 'denied', got ${consentState}`)

  await bo.conversations.sync()
  const boDm = await bo.conversations.findConversation(dm.id)

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath2,
    historySyncUrl: 'http://10.0.2.2:5558',
  })

  const state = await alix2.inboxState(true)
  assert(
    state.installations.length === 2,
    `Expected 2 installations, got ${state.installations.length}`
  )

  // Sync conversations
  await bo.conversations.sync()
  if (boDm) await boDm.sync()
  await alix2.preferences.syncConsent()
  await alix.conversations.syncAllConversations()
  await delayToPropogate(2000)
  await alix2.conversations.syncAllConversations()
  await delayToPropogate(2000)

  const dm2 = await alix2.conversations.findConversation(dm.id)
  const consentState2 = await dm2?.consentState()
  assert(consentState2 === 'denied', `Expected 'denied', got ${consentState2}`)

  await alix2.preferences.setConsentState(
    new ConsentRecord(dm2!.id, 'conversation_id', 'allowed')
  )

  const convoState = await alix2.preferences.conversationConsentState(dm2!.id)
  assert(convoState === 'allowed', `Expected 'allowed', got ${convoState}`)

  const updatedConsentState = await dm2?.consentState()
  assert(
    updatedConsentState === 'allowed',
    `Expected 'allowed', got ${updatedConsentState}`
  )

  return true
})

test('can stream consent (expected to fail unless historySyncUrl is set)', async () => {
  const [bo] = await createClients(1)
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const dbDirPath = `${RNFS.DocumentDirectoryPath}/xmtp_db`
  const dbDirPath2 = `${RNFS.DocumentDirectoryPath}/xmtp_db2`

  // Ensure the directories exist
  if (!(await RNFS.exists(dbDirPath))) {
    await RNFS.mkdir(dbDirPath)
  }
  if (!(await RNFS.exists(dbDirPath2))) {
    await RNFS.mkdir(dbDirPath2)
  }

  const alixWallet = Wallet.createRandom()

  const alix = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath,
    historySyncUrl: 'http://10.0.2.2:5558',
  })

  const alixGroup = await alix.conversations.newGroup([bo.inboxId])

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath2,
    historySyncUrl: 'http://10.0.2.2:5558',
  })

  await alixGroup.send('Hello')
  await alix.conversations.syncAllConversations()
  await alix2.conversations.syncAllConversations()

  const alix2Group = await alix2.conversations.findConversation(alixGroup.id)
  await delayToPropogate()

  const consent = []
  await alix.preferences.streamConsent(async (entry: ConsentRecord) => {
    consent.push(entry)
  })

  await delayToPropogate()

  await alix2Group!.updateConsent('denied')
  const dm = await alix2.conversations.newConversation(bo.inboxId)
  await dm!.updateConsent('denied')

  await delayToPropogate(3000)
  await alix.conversations.syncAllConversations()
  await alix2.conversations.syncAllConversations()

  assert(
    consent.length === 4,
    `Expected 4 consent records, got ${consent.length}`
  )
  const updatedConsentState = await alixGroup.consentState()
  assert(
    updatedConsentState === 'denied',
    `Expected 'denied', got ${updatedConsentState}`
  )

  alix.preferences.cancelStreamConsent()

  return true
})

test('can preference updates (expected to fail unless historySyncUrl is set)', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const dbDirPath = `${RNFS.DocumentDirectoryPath}/xmtp_db`
  const dbDirPath2 = `${RNFS.DocumentDirectoryPath}/xmtp_db2`

  // Ensure the directories exist
  if (!(await RNFS.exists(dbDirPath))) {
    await RNFS.mkdir(dbDirPath)
  }
  if (!(await RNFS.exists(dbDirPath2))) {
    await RNFS.mkdir(dbDirPath2)
  }

  const alixWallet = Wallet.createRandom()

  const alix = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath,
    historySyncUrl: 'http://10.0.2.2:5558',
  })

  const types = []
  await alix.preferences.streamPreferenceUpdates(
    async (entry: PreferenceUpdates) => {
      types.push(entry)
    }
  )

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath2,
    historySyncUrl: 'http://10.0.2.2:5558',
  })

  await alix2.conversations.syncAllConversations()
  await delayToPropogate(2000)
  await alix.conversations.syncAllConversations()
  await delayToPropogate(2000)

  assert(
    types.length === 2,
    `Expected 2 preference update, got ${types.length}`
  )

  alix.preferences.cancelStreamConsent()

  return true
})

test('get all HMAC keys', async () => {
  const [alix] = await createClients(1)

  const conversations: Conversation<any>[] = []

  for (let i = 0; i < 5; i++) {
    const [client] = await createClients(1)
    const convo = await alix.conversations.newConversation(client.inboxId)
    conversations.push(convo)
  }

  const { hmacKeys } = await alix.conversations.getHmacKeys()

  const topics = Object.keys(hmacKeys)
  conversations.forEach((conversation) => {
    assert(topics.includes(conversation.topic), 'topic not found')
  })

  return true
})

test('test stream messages in parallel', async () => {
  const messages = []
  const [alix, bo, caro, davon] = await createClients(4)

  // Create groups
  const alixGroup = await alix.conversations.newGroup([
    caro.inboxId,
    bo.inboxId,
  ])

  const caroGroup2 = await caro.conversations.newGroup([
    alix.inboxId,
    bo.inboxId,
  ])

  // Sync all clients
  await Promise.all([
    alix.conversations.syncAllConversations(),
    caro.conversations.syncAllConversations(),
    bo.conversations.syncAllConversations(),
  ])

  const boGroup = await bo.conversations.findGroup(alixGroup.id)
  const caroGroup = await caro.conversations.findGroup(alixGroup.id)
  const boGroup2 = await bo.conversations.findGroup(caroGroup2.id)
  const alixGroup2 = await alix.conversations.findGroup(caroGroup2.id)

  // Start listening for messages
  console.log('Caro is listening...')
  try {
    await caro.conversations.streamAllMessages(async (message) => {
      messages.push(message.content)
      console.log(`Caro received: ${message.content}`)
    })
  } catch (error) {
    console.error('Error while streaming messages:', error)
  }

  await delayToPropogate(1000) // 1 second delay

  // Simulate parallel message sending
  await Promise.all([
    (async () => {
      console.log('Alix is sending messages...')
      for (let i = 0; i < 20; i++) {
        const message = `Alix Message ${i}`
        await alixGroup.send(message)
        await alixGroup2!.send(message)
        console.log(`Alix sent: ${message}`)
      }
    })(),

    (async () => {
      console.log('Bo is sending messages...')
      for (let i = 0; i < 10; i++) {
        const message = `Bo Message ${i}`
        await boGroup!.send(message)
        await boGroup2!.send(message)
        console.log(`Bo sent: ${message}`)
      }
    })(),

    (async () => {
      console.log('Davon is sending spam groups...')
      for (let i = 0; i < 10; i++) {
        const spamMessage = `Davon Spam Message ${i}`
        const spamGroup = await davon.conversations.newGroup([caro.inboxId])
        await spamGroup.send(spamMessage)
        console.log(`Davon spam: ${spamMessage}`)
      }
    })(),

    (async () => {
      console.log('Caro is sending messages...')
      for (let i = 0; i < 10; i++) {
        const message = `Caro Message ${i}`
        await caroGroup!.send(message)
        await caroGroup2.send(message)
        console.log(`Caro sent: ${message}`)
      }
    })(),
  ])

  // Wait to ensure all messages are processed
  await delayToPropogate(2000)

  await assertEqual(
    messages.length,
    90,
    `Expected 90 messages, got ${messages.length}`
  )
  const caroMessagesCount = (await caroGroup!.messages()).length
  await assertEqual(
    caroMessagesCount,
    40,
    'Caro should have received 40 messages'
  )

  await Promise.all([boGroup!.sync(), alixGroup.sync(), caroGroup!.sync()])

  const boMessagesCount = (await boGroup!.messages()).length
  const alixMessagesCount = (await alixGroup.messages()).length
  const caroMessagesCountAfterSync = (await caroGroup!.messages()).length

  await assertEqual(boMessagesCount, 40, 'Bo should have received 40 messages')
  await assertEqual(
    alixMessagesCount,
    41,
    'Alix should have received 41 messages'
  )
  await assertEqual(
    caroMessagesCountAfterSync,
    40,
    'Caro should still have 40 messages'
  )

  console.log('Test passed: Streams and messages handled correctly.')
  caro.conversations.cancelStreamAllMessages()
  return true
})

test('test pausedForVersion', async () => {
  const [alix, bo] = await createClients(2)
  const group = await alix.conversations.newGroup([bo.inboxId])
  const version = await group.pausedForVersion()
  assert(version === null, `Expected null, got ${version}`)
  return true
})
