import { content } from '@xmtp/proto'
import { Wallet } from 'ethers'
import RNFS from 'react-native-fs'

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
  GroupUpdatedCodec,
  GroupUpdatedContent,
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

  shouldPush(content: NumberRef): boolean {
    return true
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

test('can set consent for multiple conversations at once', async () => {
  const [alix, bo] = await createClients(2)
  const group1 = await bo.conversations.newGroup([alix.inboxId])
  const group2 = await bo.conversations.newGroup([alix.inboxId])
  const group3 = await bo.conversations.newGroup([alix.inboxId])
  const group4 = await bo.conversations.newGroup([alix.inboxId])
  await alix.conversations.sync()
  await alix.preferences.setConsentStates([
    new ConsentRecord(group1.id, 'conversation_id', 'denied'),
    new ConsentRecord(group3.id, 'conversation_id', 'denied'),
    new ConsentRecord(group4.id, 'conversation_id', 'allowed'),
  ])
  const group1State = await alix.preferences.conversationConsentState(group1.id)
  const group2State = await alix.preferences.conversationConsentState(group2.id)
  const group3State = await alix.preferences.conversationConsentState(group3.id)
  const group4State = await alix.preferences.conversationConsentState(group4.id)

  assert(
    group1State === 'denied',
    `alix group1 should be denied but was ${group1State}`
  )
  assert(
    group2State === 'unknown',
    `alix group2 should be unknown but was ${group1State}`
  )
  assert(
    group3State === 'denied',
    `alix group3 should be denied but was ${group1State}`
  )
  assert(
    group4State === 'allowed',
    `alix group4 should be allowed but was ${group1State}`
  )
  return true
})

test('returns all push topics and validates HMAC keys', async () => {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32))
  const [bo] = await createClients(1)
  const eriWallet = Wallet.createRandom()
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

  const eriClient = await Client.create(adaptEthersWalletToSigner(eriWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath,
  })

  await eriClient.conversations.newConversation(bo.inboxId)
  await bo.conversations.newGroup([eriClient.inboxId])
  await bo.conversations.sync()

  const eriClient2 = await Client.create(adaptEthersWalletToSigner(eriWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath2,
  })
  await eriClient2.conversations.newConversation(bo.inboxId)
  const state = await eriClient2.inboxState(true)
  assert(
    state.installations.length === 2,
    `Expected 2 installations, got ${state.installations.length}`
  )

  await bo.conversations.sync()
  await eriClient.conversations.syncAllConversations()
  await eriClient2.conversations.syncAllConversations()

  const allTopics = await eriClient2.conversations.getAllPushTopics()
  const conversations = await eriClient2.conversations.list()
  const { hmacKeys } = await eriClient2.conversations.getHmacKeys()

  conversations.forEach((c) => {
    assert(
      Object.keys(hmacKeys).includes(c.topic),
      `Missing topic ${c.topic} in HMAC keys`
    )
  })

  assert(allTopics.length === 3, `Expected 3 got ${allTopics.length}`)
  assert(conversations.length === 2, `Expected 2 got ${conversations.length}`)
  return true
})

test('streams all messages filtered by consent', async () => {
  const [bo, caro, alix] = await createClients(3)
  const allowedGroup = await bo.conversations.newGroup([caro.inboxId])
  const allowedDm = await bo.conversations.findOrCreateDm(caro.inboxId)

  const deniedGroup = await bo.conversations.newGroup([alix.inboxId])
  const deniedDm = await bo.conversations.findOrCreateDm(alix.inboxId)

  await deniedGroup.updateConsent('denied')
  await deniedDm.updateConsent('denied')

  await deniedGroup.sync()
  await deniedDm.sync()

  let messageCallbacks = 0
  await bo.conversations.streamAllMessages(
    async () => {
      messageCallbacks++
    },
    undefined,
    ['allowed'] // Only allow ALLOWED consent messages
  )

  await allowedGroup.send({ text: 'hi' })
  await allowedDm.send({ text: 'hi' })

  await delayToPropogate(2000)

  await deniedGroup.send({ text: 'hi' })
  await deniedDm.send({ text: 'hi' })

  await delayToPropogate(2000)

  assert(
    messageCallbacks === 2,
    `Expected 2 allowed messages, got ${messageCallbacks}`
  )

  bo.conversations.cancelStreamAllMessages()
  return true
})

test('can create optimistic group', async () => {
  const [bo, alix] = await createClients(2)
  const group = await bo.conversations.newGroupOptimistic({
    name: 'Testing',
  })

  await group.prepareMessage({ text: 'testing' })

  const initialMessages = await group.messages()
  assert(initialMessages.length === 1, 'Expected 1 prepared message')

  await group.addMembers([alix.inboxId])
  await group.sync()
  await group.publishPreparedMessages()

  const messages = await group.messages()
  const members = await group.members()

  const name = await group.name()
  assert(name === 'Testing', 'Group name should be Testing')
  assert(messages.length === 2, 'Messages length should be 2 because of invite')
  assert(members.length === 2, 'Members list should be 2')
  return true
})

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
  assert(messages.length === 2, 'did not get messages')

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
  assert(messages.length === 2, 'did not get messages')

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
  assert(messages.length === 3, 'did not get messages')

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

  const debugInfo = await alixDm.getDebugInformation()
  assert(
    debugInfo.epoch === 1,
    `dm epoch should be 1 but was ${debugInfo.epoch}`
  )
  assert(debugInfo.maybeForked === false, `should not be forked`)
  assert(debugInfo.forkDetails === '', `fork details should be empty`)

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

  const boConvosDefault = await boClient.conversations.list()
  const boConvosAll = await boClient.conversations.list({}, undefined, [
    'allowed',
    'denied',
    'unknown',
  ])
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
    boConvosDefault.length === 3,
    `Conversation length should be 3 but was ${boConvosDefault.length}`
  )

  assert(
    boConvosAll.length === 4,
    `Conversation length should be 4 but was ${boConvosAll.length}`
  )

  assert(
    boConvosFilteredAllowed
      .map((conversation: any) => conversation.id)
      .toString() ===
      [boDmWithAlixAllowed.id, boGroupWithAlixAllowed.id].toString(),
    `Conversation allowed should be ${[
      boDmWithAlixAllowed.id,
      boGroupWithAlixAllowed.id,
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
        boDmWithCaroUnknownThenDenied?.id,
        boDmWithAlixAllowed.id,
        boGroupWithAlixAllowed.id,
      ].toString(),
    `Conversation allowed or denied filter should be ${[
      boDmWithCaroUnknownThenDenied?.id,
      boDmWithAlixAllowed.id,
      boGroupWithAlixAllowed.id,
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

  const boConvosFilteredAll = await boClient.conversations.syncAllConversations(
    ['allowed', 'denied', 'unknown']
  )

  assert(boConvos === 4, `Conversation length should be 4 but was ${boConvos}`)
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

  assert(
    boConvosFilteredAll === 5,
    `Conversation length should be 5 but was ${boConvosFilteredAll}`
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
  await delayToPropogate(1000)

  await alixGroupConversation?.send({ text: `first message` })
  await alixDmConversation?.send({ text: `first message` })

  await delayToPropogate(1000)

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
  await delayToPropogate(500)
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
    41,
    'Caro should have received 41 messages'
  )

  await Promise.all([boGroup!.sync(), alixGroup.sync(), caroGroup!.sync()])

  const boMessagesCount = (await boGroup!.messages()).length
  const alixMessagesCount = (await alixGroup.messages()).length
  const caroMessagesCountAfterSync = (await caroGroup!.messages()).length

  await assertEqual(boMessagesCount, 41, 'Bo should have received 41 messages')
  await assertEqual(
    alixMessagesCount,
    41,
    'Alix should have received 41 messages'
  )
  await assertEqual(
    caroMessagesCountAfterSync,
    41,
    'Caro should still have 41 messages'
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

test('messages dont disappear createGroup', async () => {
  const [alix, bo] = await createClients(2)

  const groupCreationOptions = {
    disappearingMessageSettings: undefined,
  }
  const alixGroup = await alix.conversations.newGroup(
    [bo.inboxId],
    groupCreationOptions
  )
  await alixGroup.sync()

  const settings = await alixGroup.isDisappearingMessagesEnabled()
  assert(settings === false, `Expected null, got ${settings}`)

  await alix.conversations.syncAllConversations()

  await alixGroup.send({ text: 'hello world' })

  const alixMessages = await alixGroup.messages()
  assert(
    alixMessages.length === 2,
    `Expected 2 messages for alix, got ${alixMessages.length}`
  )

  // Wait 1 second
  await delayToPropogate(1000)

  const messages2 = await alixGroup.messages()
  assert(
    messages2.length === 2,
    `Expected 2 messages for alix after sync, got ${messages2.length}`
  )

  return true
})

test('messages dont disappear newGroupCustomPermissionsWithIdentities', async () => {
  const [alix, bo] = await createClients(2)

  const groupCreationOptions = {
    disappearingMessageSettings: undefined,
  }
  const alixGroup =
    await alix.conversations.newGroupCustomPermissionsWithIdentities(
      [bo.publicIdentity],
      {
        addMemberPolicy: 'allow',
        removeMemberPolicy: 'admin',
        addAdminPolicy: 'admin',
        removeAdminPolicy: 'admin',
        updateGroupNamePolicy: 'allow',
        updateGroupDescriptionPolicy: 'allow',
        updateGroupImagePolicy: 'allow',
        updateMessageDisappearingPolicy: 'admin',
        updateAppDataPolicy: 'allow',
      },
      groupCreationOptions
    )
  await alixGroup.sync()

  const settings = await alixGroup.isDisappearingMessagesEnabled()
  assert(settings === false, `Expected null, got ${settings}`)

  await alix.conversations.syncAllConversations()

  await alixGroup.send({ text: 'hello world' })

  const alixMessages = await alixGroup.messages()
  assert(
    alixMessages.length === 2,
    `Expected 2 messages for alix, got ${alixMessages.length}`
  )

  // Wait 1 second
  await delayToPropogate(1000)

  const messages2 = await alixGroup.messages()
  assert(
    messages2.length === 2,
    `Expected 2 messages for alix after sync, got ${messages2.length}`
  )

  return true
})

test('messages dont disappear newGroupWithIdentities', async () => {
  const [alix, bo] = await createClients(2)

  const alixGroup = await alix.conversations.newGroupWithIdentities([
    bo.publicIdentity,
  ])
  await alixGroup.sync()

  const settings = await alixGroup.isDisappearingMessagesEnabled()
  assert(settings === false, `Expected null, got ${settings}`)

  await alix.conversations.syncAllConversations()

  await alixGroup.send({ text: 'hello world' })

  const alixMessages = await alixGroup.messages()
  assert(
    alixMessages.length === 2,
    `Expected 2 messages for alix, got ${alixMessages.length}`
  )

  // Wait 1 second
  await delayToPropogate(1000)

  const messages2 = await alixGroup.messages()
  assert(
    messages2.length === 2,
    `Expected 2 messages for alix after sync, got ${messages2.length}`
  )

  return true
})

test('new groups and dms contain a message including who added the user', async () => {
  const [alix, bo] = await createClients(2)

  // Register the GroupUpdatedCodec to handle group updated messages
  Client.register(new GroupUpdatedCodec())

  // Test that group we are added to contains the GroupUpdated message with who added us
  const alixGroup = await alix.conversations.newGroup([bo.inboxId])
  await bo.conversations.sync()
  const boGroup = await bo.conversations.findGroup(alixGroup.id)
  const boGroupMessages = await boGroup?.messages()
  assert(boGroupMessages!.length === 1, 'Bo group should have 1 message')

  const message = boGroupMessages![0]
  await assertEqual(
    message.contentTypeId,
    'xmtp.org/group_updated:1.0',
    'Message should be a group updated message'
  )
  console.log(message.contentTypeId)

  const groupUpdatedMessage: GroupUpdatedContent = message.content()
  const addedByInboxId = groupUpdatedMessage.initiatedByInboxId
  await assertEqual(
    addedByInboxId,
    alix.inboxId,
    'Added by inbox id should be alix'
  )

  // Test that dm we are added to contains the GroupUpdated message with who added us
  const boDm = await bo.conversations.findOrCreateDm(alix.inboxId)
  await bo.conversations.sync()
  const alixDm = await bo.conversations.findConversation(boDm.id)
  const alixDmMessages = await alixDm?.messages()
  assert(alixDmMessages!.length === 1, 'Bo dm should have 1 message')
  const dmMessage = alixDmMessages![0]
  await assertEqual(
    dmMessage.contentTypeId,
    'xmtp.org/group_updated:1.0',
    'Message should be a group updated message'
  )
  console.log(dmMessage.contentTypeId)

  const dmGroupUpdatedMessage: GroupUpdatedContent = dmMessage.content()
  const dmAddedByInboxId = dmGroupUpdatedMessage.initiatedByInboxId
  await assertEqual(
    dmAddedByInboxId,
    bo.inboxId,
    'Added by inbox id should be bo'
  )

  return true
})

test('sender can delete their own message', async () => {
  const [alix, bo] = await createClients(2)

  const alixGroup = await alix.conversations.newGroup([bo.inboxId])
  await alixGroup.sync()

  let messages = await alixGroup.messages()
  let messagesString = messages.map((m) => `- ${m.id}: ${m.contentTypeId}`).join('\n')
  console.log('After group creation::\n' + messagesString)

  const messageId = await alixGroup.send({
    text: 'Hello, this message will be deleted',
  })
  await alixGroup.sync()

  messages = await alixGroup.messages()
  messagesString = messages.map((m) => `- ${m.id}: ${m.contentTypeId}`).join('\n')
  console.log('After send and sync::\n' + messagesString)

  messages = await alixGroup.messages()
  assert(
    messages.some((m) => m.id === messageId),
    'Message should exist before deletion'
  )

  const deletionMessageId = await alixGroup.deleteMessage(messageId)
  assert(deletionMessageId !== null, 'Deletion message id should not be null')

  await alixGroup.sync()
  messages = await alixGroup.messages()

  messages = await alixGroup.messages()
  messagesString = messages.map((m) => `- ${m.id}: ${m.contentTypeId}`).join('\n')
  console.log('After delete and sync::\n' + messagesString)
  assert(
    messages.some((m) => m.id === deletionMessageId),
    'Deletion message should exist after deletion'
  )

  // format the list of messages and the contents nicely and print them out
  messagesString = messages
    .map((m) => {
      const base = `- ${m.id}: ${m.contentTypeId}`
      if (m.contentTypeId.includes('text')) {
        return `${base} - "${m.content()}"`
      }
    })
    .join('\n')
  console.log('Messages after deletion:\n' + messagesString)

  assert(
    !messages.some((m) => m.id === messageId),
    'Original message should no longer exist after deletion'
  )

  return true
})

test('super admin can delete others message', async () => {
  const [alix, bo] = await createClients(2)

  const alixGroup = await alix.conversations.newGroup([bo.inboxId])
  await bo.conversations.sync()
  const boGroup = await bo.conversations.findGroup(alixGroup.id)
  assert(boGroup !== undefined, 'Bo should find the group')

  const messageId = await boGroup!.send({ text: 'Hello from Bo' })
  await alixGroup.sync()
  await boGroup!.sync()

  const isSuperAdmin = await alixGroup.isSuperAdmin(alix.inboxId)
  assert(isSuperAdmin === true, 'Alix should be super admin')

  const deletionMessageId = await alixGroup.deleteMessage(messageId)
  assert(deletionMessageId !== null, 'Deletion message id should not be null')

  return true
})

test('regular user cannot delete others message', async () => {
  const [alix, bo] = await createClients(2)

  const alixGroup = await alix.conversations.newGroup([bo.inboxId])
  await bo.conversations.sync()
  const boGroup = await bo.conversations.findGroup(alixGroup.id)
  assert(boGroup !== undefined, 'Bo should find the group')

  const messageId = await alixGroup.send({ text: 'Hello from Alix' })
  await alixGroup.sync()
  await boGroup!.sync()

  const isSuperAdmin = await boGroup!.isSuperAdmin(bo.inboxId)
  assert(isSuperAdmin === false, 'Bo should not be super admin')

  try {
    await boGroup!.deleteMessage(messageId)
    return false // Should have thrown
  } catch (e) {
    // Expected error - regular user cannot delete others' messages
    return true
  }
})

test('cannot delete already deleted message', async () => {
  const [alix, bo] = await createClients(2)

  const alixGroup = await alix.conversations.newGroup([bo.inboxId])
  const messageId = await alixGroup.send({ text: 'Message to delete twice' })

  await alixGroup.deleteMessage(messageId)
  await alixGroup.sync()

  try {
    await alixGroup.deleteMessage(messageId)
    return false // Should have thrown
  } catch (e) {
    // Expected error - cannot delete already deleted message
    return true
  }
})

test('can delete message in DM', async () => {
  const [alix, bo] = await createClients(2)

  const alixDm = await alix.conversations.findOrCreateDm(bo.inboxId)
  const messageId = await alixDm.send({ text: 'Hello in DM' })

  await bo.conversations.syncAllConversations()
  const boDm = await bo.conversations.findDmByInboxId(alix.inboxId)

  await alixDm.sync()
  let messages = await alixDm.messages()
  assert(
    messages.some((m) => m.id === messageId),
    'Message should exist before deletion'
  )

  // Bo trying to delete the message from alix should result in an error
  try {
    await boDm!.deleteMessage(messageId)
    return false // Should have thrown
  } catch (e) {
    // Expected error: user cannot delete other's messages in a DM
  }

  const deletionMessageId = await alixDm.deleteMessage(messageId)
  assert(deletionMessageId !== null, 'Deletion message id should not be null')

  await alixDm.sync()
  messages = await alixDm.messages()
  assert(
    messages.some((m) => m.id === deletionMessageId),
    'Deletion message should exist after deletion'
  )

  return true
})

test('delete message with invalid id throws error', async () => {
  const [alix, bo] = await createClients(2)

  const alixGroup = await alix.conversations.newGroup([bo.inboxId])

  try {
    await alixGroup.deleteMessage(
      '0000000000000000000000000000000000000000000000000000000000000000' as any
    )
    return false // Should have thrown
  } catch (e) {
    // Expected error - invalid message id
    return true
  }
})

test('streams message deletion to other user when message is deleted', async () => {
  const [alix, bo] = await createClients(2)

  const alixGroup = await alix.conversations.newGroup([bo.inboxId])
  await bo.conversations.sync()
  const boGroup = await bo.conversations.findGroup(alixGroup.id)
  assert(boGroup !== undefined, 'Bo should find the group')

  // Set up deletion stream for Bo
  let deletedMessageId: string | null = null
  let deletedConversationId: string | null = null
  await bo.conversations.streamMessageDeletions(
    async (messageId, conversationId) => {
      console.log(
        `Bo received deletion: message ${messageId} in ${conversationId}`
      )
      deletedMessageId = messageId
      deletedConversationId = conversationId
    }
  )

  // Alix sends a message
  const messageId = await alixGroup.send({
    text: 'This message will be deleted',
  })
  await alixGroup.sync()
  await boGroup!.sync()

  // Verify Bo has the message
  const boMessages = await boGroup!.messages()
  assert(
    boMessages.some((m) => m.id === messageId),
    'Bo should have the message before deletion'
  )

  // Alix deletes the message
  await alixGroup.deleteMessage(messageId)
  await alixGroup.sync()
  await boGroup!.sync()

  // Wait for the deletion stream to trigger
  await delayToPropogate(2000)

  // Verify Bo received the deletion event
  assert(
    deletedMessageId === messageId,
    `Bo should have received deletion for message ${messageId}, got ${deletedMessageId}`
  )
  assert(
    deletedConversationId === alixGroup.id,
    `Deleted conversation id should match ${alixGroup.id}, got ${deletedConversationId}`
  )

  // Clean up
  bo.conversations.cancelStreamMessageDeletions()

  return true
})

test('prepareMessage with noSend does not send until publishMessage is called', async () => {
  const [alix, bo] = await createClients(2, undefined, [new NumberCodec()])

  const alixGroup = await alix.conversations.newGroup([bo.inboxId])
  await bo.conversations.sync()
  const boGroup = await bo.conversations.findGroup(alixGroup.id)
  assert(boGroup !== undefined, 'Bo should find the group')

  // Prepare a regular text message with noSend=true
  const textMessageId = await alixGroup.prepareMessage(
    { text: 'Hello, this is a noSend text message' },
    undefined,
    true // noSend
  )

  // Prepare a custom codec message with noSend=true
  const customMessageId = await alixGroup.prepareMessage(
    { topNumber: { bottomNumber: 42 } },
    { contentType: ContentTypeNumber },
    true // noSend
  )

  // Verify the messages are in Alix's local messages
  const alixMessages = await alixGroup.messages()
  assert(
    alixMessages.some((m) => m.id === textMessageId),
    'Text message should exist locally'
  )
  assert(
    alixMessages.some((m) => m.id === customMessageId),
    'Custom message should exist locally'
  )

  // Call publishPreparedMessages - this should NOT send noSend messages
  await alixGroup.publishPreparedMessages()
  await alixGroup.sync()
  await boGroup!.sync()

  // Bo should NOT have received the messages yet (only the group creation message)
  let boMessages = await boGroup!.messages()
  assert(
    !boMessages.some((m) => m.id === textMessageId),
    'Bo should NOT have text message after publishPreparedMessages'
  )
  assert(
    !boMessages.some((m) => m.id === customMessageId),
    'Bo should NOT have custom message after publishPreparedMessages'
  )

  // Now publish the text message individually
  await alixGroup.publishMessage(textMessageId)
  await alixGroup.sync()
  await boGroup!.sync()

  // Bo should now have the text message
  boMessages = await boGroup!.messages()
  assert(
    boMessages.some((m) => m.id === textMessageId),
    'Bo should have text message after publishMessage'
  )
  assert(
    !boMessages.some((m) => m.id === customMessageId),
    'Bo should still NOT have custom message'
  )

  // Now publish the custom message individually
  await alixGroup.publishMessage(customMessageId)
  await alixGroup.sync()
  await boGroup!.sync()

  // Bo should now have both messages
  boMessages = await boGroup!.messages()
  assert(
    boMessages.some((m) => m.id === textMessageId),
    'Bo should have text message'
  )
  assert(
    boMessages.some((m) => m.id === customMessageId),
    'Bo should have custom message after publishMessage'
  )

  // Verify the content of the custom message
  const customMessage = boMessages.find((m) => m.id === customMessageId)
  const customContent = customMessage?.content() as NumberRef
  assert(
    customContent?.topNumber?.bottomNumber === 42,
    `Custom content should have bottomNumber 42, got ${customContent?.topNumber?.bottomNumber}`
  )

  return true
})
