import { content } from '@xmtp/proto'
import ReactNativeBlobUtil from 'react-native-blob-util'

import { Test, assert, createClients, delayToPropogate } from './test-utils'
import {
  Client,
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

const { fs } = ReactNativeBlobUtil

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
  const bob = await Client.createRandom({
    env: 'local',
    codecs: [new NumberCodec()],
    dbEncryptionKey: keyBytes,
  })
  const alice = await Client.createRandom({
    env: 'local',
    codecs: [new NumberCodec()],
    dbEncryptionKey: keyBytes,
  })

  bob.register(new NumberCodec())
  alice.register(new NumberCodec())

  await delayToPropogate()

  const bobConvo = await bob.conversations.newConversation(alice.address)
  await delayToPropogate()
  const aliceConvo = await alice.conversations.newConversation(bob.address)

  await bobConvo.send(
    { topNumber: { bottomNumber: 12 } },
    { contentType: ContentTypeNumber }
  )

  const messages = await aliceConvo.messages()
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
  const alice = await Client.createRandom({
    env: 'local',
    dbEncryptionKey: keyBytes,
  })
  bob.register(new NumberCodecEmptyFallback())
  bob.register(new NumberCodecUndefinedFallback())
  const bobConvo = await bob.conversations.newConversation(alice.address)
  const aliceConvo = await alice.conversations.newConversation(bob.address)

  await bobConvo.send(12, { contentType: ContentTypeNumberWithEmptyFallback })

  await bobConvo.send(12, {
    contentType: ContentTypeNumberWithUndefinedFallback,
  })

  const messages = await aliceConvo.messages()
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

// test('can find a conversations by id', async () => {
//   const [alixClient, boClient] = await createClients(2)
//   const alixGroup = await alixClient.conversations.newGroup([boClient.address])
//   const alixDm = await alixClient.conversations.findOrCreateDm(boClient.address)

//   await boClient.conversations.sync()
//   const boGroup = await boClient.conversations.findConversation(alixGroup.id)
//   const boDm = await boClient.conversations.findConversation(alixDm.id)
//   const boDm2 = await boClient.conversations.findConversation(
//     'GARBAGE' as ConversationId
//   )

//   assert(boDm2 === undefined, `bodm2 should be undefined`)

//   assert(
//     boGroup?.id === alixGroup.id,
//     `bo group id ${boGroup?.id} does not match alix group id ${alixGroup.id}`
//   )

//   assert(
//     boDm?.id === alixDm.id,
//     `bo dm id ${boDm?.id} does not match alix dm id ${alixDm.id}`
//   )

//   return true
// })

// test('can find a conversation by topic', async () => {
//   const [alixClient, boClient] = await createClients(2)
//   const alixGroup = await alixClient.conversations.newGroup([boClient.address])
//   const alixDm = await alixClient.conversations.findOrCreateDm(boClient.address)

//   await boClient.conversations.sync()
//   const boGroup = await boClient.conversations.findConversationByTopic(
//     alixGroup.topic
//   )
//   const boDm = await boClient.conversations.findConversationByTopic(
//     alixDm.topic
//   )

//   assert(
//     boGroup?.id === alixGroup.id,
//     `bo group topic ${boGroup?.id} does not match alix group topic ${alixGroup.id}`
//   )

//   assert(
//     boDm?.id === alixDm.id,
//     `bo dm topic ${boDm?.id} does not match alix dm topic ${alixDm.id}`
//   )

//   return true
// })

// test('can find a dm by inbox id', async () => {
//   const [alixClient, boClient] = await createClients(2)
//   const alixDm = await alixClient.conversations.findOrCreateDm(boClient.address)

//   await boClient.conversations.sync()
//   const boDm = await boClient.conversations.findDmByInboxId(alixClient.inboxId)

//   assert(
//     boDm?.id === alixDm.id,
//     `bo dm id ${boDm?.id} does not match alix dm id ${alixDm.id}`
//   )

//   return true
// })

// test('can find a dm by address', async () => {
//   const [alixClient, boClient] = await createClients(2)
//   const alixDm = await alixClient.conversations.findOrCreateDm(boClient.address)

//   await boClient.conversations.sync()
//   const boDm = await boClient.conversations.findDmByAddress(alixClient.address)

//   assert(
//     boDm?.id === alixDm.id,
//     `bo dm id ${boDm?.id} does not match alix dm id ${alixDm.id}`
//   )

//   return true
// })

// test('can list conversations with params', async () => {
//   const [alixClient, boClient, caroClient] = await createClients(3)

//   const boGroup1 = await boClient.conversations.newGroup([alixClient.address])
//   const boGroup2 = await boClient.conversations.newGroup([alixClient.address])
//   const boDm1 = await boClient.conversations.findOrCreateDm(alixClient.address)
//   const boDm2 = await boClient.conversations.findOrCreateDm(caroClient.address)

//   await boGroup1.send({ text: `first message` })
//   await boGroup1.send({ text: `second message` })
//   await boGroup1.send({ text: `third message` })
//   await boDm2.send({ text: `third message` })
//   await boGroup2.send({ text: `first message` })
//   await boDm1.send({ text: `dm message` })
//   // Order should be [Dm1, Group2, Dm2, Group1]

//   await boClient.conversations.syncAllConversations()
//   const boConvosOrderCreated = await boClient.conversations.list()
//   const boConvosOrderLastMessage = await boClient.conversations.list(
//     { lastMessage: true },
//     'lastMessage'
//   )
//   const boGroupsLimit = await boClient.conversations.list({}, undefined, 1)

//   assert(
//     boConvosOrderCreated.map((group: any) => group.id).toString() ===
//       [boGroup1.id, boGroup2.id, boDm1.id, boDm2.id].toString(),
//     `Conversation created at order should be ${[
//       boGroup1.id,
//       boGroup2.id,
//       boDm1.id,
//       boDm2.id,
//     ].toString()} but was ${boConvosOrderCreated
//       .map((group: any) => group.id)
//       .toString()}`
//   )

//   assert(
//     boConvosOrderLastMessage.map((group: any) => group.id).toString() ===
//       [boDm1.id, boGroup2.id, boDm2.id, boGroup1.id].toString(),
//     `Conversation last message order should be ${[
//       boDm1.id,
//       boGroup2.id,
//       boDm2.id,
//       boGroup1.id,
//     ].toString()} but was ${boConvosOrderLastMessage
//       .map((group: any) => group.id)
//       .toString()}`
//   )

//   const messages = await boConvosOrderLastMessage[0].messages()
//   assert(
//     messages[0].content() === 'dm message',
//     `last message 1 should be dm message ${messages[0].content()}`
//   )
//   // assert(
//   //   boConvosOrderLastMessage[0].lastMessage?.content() === 'dm message',
//   //   `last message 2 should be dm message ${boConvosOrderLastMessage[0].lastMessage?.content()}`
//   // )
//   assert(
//     boGroupsLimit.length === 1,
//     `List length should be 1 but was ${boGroupsLimit.length}`
//   )
//   assert(
//     boGroupsLimit[0].id === boGroup1.id,
//     `Group should be ${boGroup1.id} but was ${boGroupsLimit[0].id}`
//   )

//   return true
// })

// test('can list groups', async () => {
//   const [alixClient, boClient, caroClient] = await createClients(3)

//   const boGroup = await boClient.conversations.newGroup([alixClient.address])
//   await boClient.conversations.newGroup([
//     caroClient.address,
//     alixClient.address,
//   ])
//   const boDm = await boClient.conversations.findOrCreateDm(caroClient.address)
//   await boClient.conversations.findOrCreateDm(alixClient.address)

//   const boConversations = await boClient.conversations.list()
//   await alixClient.conversations.sync()
//   const alixConversations = await alixClient.conversations.list()

//   assert(
//     boConversations.length === 4,
//     `bo conversation lengths should be 4 but was ${boConversations.length}`
//   )

//   assert(
//     alixConversations.length === 3,
//     `alix conversation lengths should be 3 but was ${alixConversations.length}`
//   )

//   if (
//     boConversations[0].topic !== boGroup.topic ||
//     boConversations[0].version !== ConversationVersion.GROUP ||
//     boConversations[2].version !== ConversationVersion.DM ||
//     boConversations[2].createdAt !== boDm.createdAt
//   ) {
//     throw Error('Listed containers should match streamed containers')
//   }

//   return true
// })

// test('can list conversation messages', async () => {
//   const [alixClient, boClient, caroClient] = await createClients(3)

//   const boGroup = await boClient.conversations.newGroup([alixClient.address])
//   const boDm = await boClient.conversations.findOrCreateDm(caroClient.address)
//   const boGroupConversation = await boClient.conversations.findConversation(
//     boGroup.id
//   )
//   const boDmConversation = await boClient.conversations.findConversation(
//     boDm.id
//   )

//   await boGroupConversation?.send('hello')
//   await boGroupConversation?.send('hello')
//   await boDmConversation?.send('hello')
//   await boDmConversation?.send('hello')

//   const boGroupMessages = await boGroupConversation?.messages()
//   const boDmMessages = await boDmConversation?.messages()

//   assert(
//     boGroupMessages?.length === 3,
//     `bo conversation lengths should be 4 but was ${boGroupMessages?.length}`
//   )

//   assert(
//     boDmMessages?.length === 3,
//     `alix conversation lengths should be 3 but was ${boDmMessages?.length}`
//   )

//   return true
// })

// test('can stream both conversations and messages at same time', async () => {
//   const [alix, bo] = await createClients(2)

//   let conversationCallbacks = 0
//   let messageCallbacks = 0
//   await bo.conversations.stream(async () => {
//     conversationCallbacks++
//   })

//   await bo.conversations.streamAllMessages(async () => {
//     messageCallbacks++
//   })

//   const group = await alix.conversations.newGroup([bo.address])
//   const dm = await alix.conversations.findOrCreateDm(bo.address)
//   await delayToPropogate()
//   await group.send('hello')
//   await dm.send('hello')
//   await delayToPropogate()

//   assert(
//     conversationCallbacks === 2,
//     'conversation stream should have received 2 conversation'
//   )
//   assert(
//     messageCallbacks === 2,
//     'message stream should have received 2 message'
//   )

//   return true
// })

// test('can stream conversation messages', async () => {
//   const [alixClient, boClient] = await createClients(2)

//   const alixGroup = await alixClient.conversations.newGroup([boClient.address])
//   const alixDm = await alixClient.conversations.findOrCreateDm(boClient.address)
//   const alixGroupConversation = await alixClient.conversations.findConversation(
//     alixGroup.id
//   )
//   const alixDmConversation = await alixClient.conversations.findConversation(
//     alixDm.id
//   )

//   let dmMessageCallbacks = 0
//   let conversationMessageCallbacks = 0
//   await alixGroupConversation?.streamMessages(async () => {
//     conversationMessageCallbacks++
//   })

//   await alixDmConversation?.streamMessages(async () => {
//     dmMessageCallbacks++
//   })

//   await alixGroupConversation?.send({ text: `first message` })
//   await alixDmConversation?.send({ text: `first message` })

//   assert(
//     conversationMessageCallbacks === 1,
//     'conversation stream should have received 1 conversation'
//   )
//   assert(
//     dmMessageCallbacks === 1,
//     'message stream should have received 1 message'
//   )

//   return true
// })

// test('can stream all groups and conversations', async () => {
//   const [alixClient, boClient, caroClient] = await createClients(3)

//   const containers: Conversation<any>[] = []
//   await alixClient.conversations.stream(
//     async (conversation: Conversation<any>) => {
//       containers.push(conversation)
//     }
//   )

//   await boClient.conversations.newGroup([alixClient.address])
//   await delayToPropogate()
//   if ((containers.length as number) !== 1) {
//     throw Error(
//       'Unexpected num conversations (should be 1): ' + containers.length
//     )
//   }

//   await boClient.conversations.findOrCreateDm(alixClient.address)
//   await delayToPropogate()
//   if ((containers.length as number) !== 2) {
//     throw Error(
//       'Unexpected num conversations (should be 2): ' + containers.length
//     )
//   }

//   await alixClient.conversations.findOrCreateDm(caroClient.address)
//   await delayToPropogate()
//   if (containers.length !== 3) {
//     throw Error(
//       'Expected conversations length 3 but it is: ' + containers.length
//     )
//   }

//   alixClient.conversations.cancelStream()
//   await delayToPropogate()

//   await caroClient.conversations.newGroup([alixClient.address])
//   await delayToPropogate()
//   if ((containers.length as number) !== 3) {
//     throw Error(
//       'Unexpected num conversations (should be 3): ' + containers.length
//     )
//   }

//   return true
// })

// test('can streamAll from multiple clients', async () => {
//   const [alix, bo, caro] = await createClients(3)

//   // Setup stream alls
//   const allBoConversations: any[] = []
//   const allAliConversations: any[] = []

//   await bo.conversations.stream(async (conversation) => {
//     allBoConversations.push(conversation)
//   })
//   await alix.conversations.stream(async (conversation) => {
//     allAliConversations.push(conversation)
//   })

//   // Start Caro starts a new conversation.
//   await caro.conversations.newConversation(alix.address)
//   await delayToPropogate()
//   if (allBoConversations.length !== 0) {
//     throw Error(
//       'Unexpected all conversations count for Bo ' +
//         allBoConversations.length +
//         ' and Alix had ' +
//         allAliConversations.length
//     )
//   }
//   if (allAliConversations.length !== 1) {
//     throw Error(
//       'Unexpected all conversations count ' + allAliConversations.length
//     )
//   }
//   return true
// })

// test('can streamAll from multiple clients - swapped orderring', async () => {
//   const [alix, bo, caro] = await createClients(3)

//   // Setup stream alls
//   const allBoConversations: any[] = []
//   const allAliConversations: any[] = []

//   await alix.conversations.stream(async (conversation) => {
//     allAliConversations.push(conversation)
//   })

//   await bo.conversations.stream(async (conversation) => {
//     allBoConversations.push(conversation)
//   })

//   // Start Caro starts a new conversation.
//   await caro.conversations.newConversation(alix.address)
//   await delayToPropogate()
//   if (allBoConversations.length !== 0) {
//     throw Error(
//       'Unexpected all conversations count for Bo ' +
//         allBoConversations.length +
//         ' and Alix had ' +
//         allAliConversations.length
//     )
//   }
//   if (allAliConversations.length !== 1) {
//     throw Error(
//       'Unexpected all conversations count ' + allAliConversations.length
//     )
//   }
//   return true
// })

// test('can streamAllMessages from multiple clients', async () => {
//   const [alix, bo, caro] = await createClients(3)

//   // Setup stream
//   const allBoMessages: any[] = []
//   const allAliMessages: any[] = []

//   await bo.conversations.streamAllMessages(async (conversation) => {
//     allBoMessages.push(conversation)
//   })
//   await alix.conversations.streamAllMessages(async (conversation) => {
//     allAliMessages.push(conversation)
//   })

//   // Start Caro starts a new conversation.
//   const caroConversation = await caro.conversations.newConversation(
//     alix.address
//   )
//   await caroConversation.send({ text: `Message` })
//   await delayToPropogate()
//   if (allBoMessages.length !== 0) {
//     throw Error('Unexpected all messages count for Bo ' + allBoMessages.length)
//   }

//   if (allAliMessages.length !== 1) {
//     throw Error(
//       'Unexpected all conversations count for Ali ' + allAliMessages.length
//     )
//   }

//   return true
// })

// test('can streamAllMessages from multiple clients - swapped', async () => {
//   const [alix, bo, caro] = await createClients(3)

//   // Setup stream
//   const allBoMessages: any[] = []
//   const allAliMessages: any[] = []
//   const caroGroup = await caro.conversations.newGroup([alix.address])

//   await alix.conversations.streamAllMessages(async (conversation) => {
//     allAliMessages.push(conversation)
//   })
//   await bo.conversations.streamAllMessages(async (conversation) => {
//     allBoMessages.push(conversation)
//   })

//   // Start Caro starts a new conversation.
//   const caroConvo = await caro.conversations.newConversation(alix.address)
//   await delayToPropogate()
//   await caroConvo.send({ text: `Message` })
//   await caroGroup.send({ text: `Message` })
//   await delayToPropogate()
//   if (allBoMessages.length !== 0) {
//     throw Error(
//       'Unexpected all conversations count for Bo ' + allBoMessages.length
//     )
//   }

//   if (allAliMessages.length !== 2) {
//     throw Error(
//       'Unexpected all conversations count for Ali ' + allAliMessages.length
//     )
//   }

//   return true
// })
