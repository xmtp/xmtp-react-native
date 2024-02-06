import { content } from '@xmtp/proto'
import ReactNativeBlobUtil from 'react-native-blob-util'
import { TextEncoder, TextDecoder } from 'text-encoding'
import { DecodedMessage } from 'xmtp-react-native-sdk/lib/DecodedMessage'

import {
  Query,
  JSContentCodec,
  Client,
  Conversation,
  StaticAttachmentCodec,
  RemoteAttachmentCodec,
  RemoteAttachmentContent,
} from '../../src/index'

type EncodedContent = content.EncodedContent
type ContentTypeId = content.ContentTypeId

const { fs } = ReactNativeBlobUtil

const ContentTypeNumber: ContentTypeId = {
  authorityId: 'org',
  typeId: 'number',
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

export type Test = {
  name: string
  run: () => Promise<boolean>
}

export const tests: Test[] = []

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(msg)
  }
}

function delayToPropogate(): Promise<void> {
  // delay 1s to avoid clobbering
  return new Promise((r) => setTimeout(r, 100))
}

function test(name: string, perform: () => Promise<boolean>) {
  tests.push({ name, run: perform })
}

test('can make a client', async () => {
  const client = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
  })
  client.register(new RemoteAttachmentCodec())
  if (Object.keys(client.codecRegistry).length !== 2) {
    throw new Error(
      `Codecs length should be 2 not ${
        Object.keys(client.codecRegistry).length
      }`
    )
  }
  return client.address.length > 0
})

test('can make a MLS V3 client', async () => {
  const client = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableAlphaMls: true
  })

  return true
})

test('production MLS V3 client creation throws error', async () => {
  try {
    const client = await Client.createRandom({
      env: 'production',
      appVersion: 'Testing/0.0.0',
      enableAlphaMls: true
    })
  } catch (error: any) {
    return error.message.endsWith("Environment must be \"local\" or \"dev\" to enable alpha MLS")
  }
  throw new Error('should throw error on MLS V3 client create when environment is not local')
})

test('can message in a group', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true
  })
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true
  })

  // Alice's num groups start at 0
  let aliceGroups = await aliceClient.conversations.listGroups()
  if (aliceGroups.length != 0) {
    throw new Error('num groups should be 0')
  }

  // Alice creates a group
  const aliceGroup = await aliceClient.conversations.newGroup(
    [bobClient.address, camClient.address]
  )

  // Alice's num groups == 1
  aliceGroups = await aliceClient.conversations.listGroups()
  if (aliceGroups.length != 1) {
    throw new Error('num groups should be 1')
  }

  // Alice can confirm memberAddresses
  let memberAddresses = await aliceGroup.memberAddresses()
  if (memberAddresses.length != 3) {
    throw new Error('num group members should be 3')
  }
  const lowercasedAddresses: string[] = memberAddresses.map(s => s.toLowerCase());
  if (!(lowercasedAddresses.includes(aliceClient.address.toLowerCase())
      && lowercasedAddresses.includes(bobClient.address.toLowerCase())
      && lowercasedAddresses.includes(camClient.address.toLowerCase()))) {
        throw new Error('missing address')
      }

  // Alice can send messages
  aliceGroup.send("hello, world")
  aliceGroup.send("gm")

  // Bob's num groups == 1
  await bobClient.conversations.syncGroups()
  let bobGroups = await bobClient.conversations.listGroups()
  if (bobGroups.length != 1) {
    throw new Error('num groups for bob should be 1, but it is' + bobGroups.length)
  }

  // Bob can read messages from Alice
  await bobGroups[0].sync()
  let bobMessages: DecodedMessage[] = await bobGroups[0].messages()
  if (bobMessages.length != 2) {
    throw new Error('num messages for bob should be 2, but it is' + bobMessages.length)
  }
  let messageString: string = JSON.stringify(bobMessages[0])
  if (!messageString.includes("gm")) {
    throw new Error('newest Message should include gm')
  }
  let messageString2: string = JSON.stringify(bobMessages[1])
  if (!messageString2.includes("hello, world")) {
    throw new Error('newest Message should include gm')
  }
  // Bob can send a message
  bobGroups[0].send("hey guys!")

  // Cam's num groups == 1
  await camClient.conversations.syncGroups()
  let camGroups = await camClient.conversations.listGroups()
  if (camGroups.length != 1) {
    throw new Error('num groups for cam should be 1, but it is' + camGroups.length)
  }

  // Cam can read messages from Alice and Bob
  await camGroups[0].sync()
  let camMessages = await camGroups[0].messages()
  let messageString3: string = JSON.stringify(camMessages[1])
  if (!messageString3.includes("gm")) {
    throw new Error('second Message should include gm')
  }
  let messageString4: string = JSON.stringify(camMessages[0])
  if (!messageString4.includes("hey guys!")) {
    throw new Error('newest Message should include hey guys!')
  }

  return true
})

test('can pass a custom filter date and receive message objects with expected dates', async () => {
  try {
    const bob = await Client.createRandom({ env: 'local' })
    const alice = await Client.createRandom({ env: 'local' })

    if (bob.address === alice.address) {
      throw new Error('bob and alice should be different')
    }

    const bobConversation = await bob.conversations.newConversation(
      alice.address
    )

    const aliceConversation = (await alice.conversations.list())[0]
    if (!aliceConversation) {
      throw new Error('aliceConversation should exist')
    }

    const sentAt = Date.now()
    await bobConversation.send({ text: 'hello' })

    const initialQueryDate = new Date('2023-01-01')
    const finalQueryDate = new Date('2025-01-01')

    // Show all messages before date in the past
    const messages1: DecodedMessage<any>[] = await aliceConversation.messages(
      undefined,
      initialQueryDate
    )

    // Show all messages before date in the future
    const messages2: DecodedMessage<any>[] = await aliceConversation.messages(
      undefined,
      finalQueryDate
    )

    const isAboutRightSendTime = Math.abs(messages2[0].sent - sentAt) < 1000
    if (!isAboutRightSendTime) return false

    const passingDateFieldSuccessful =
      !messages1.length && messages2.length === 1

    if (!passingDateFieldSuccessful) return false

    // repeat the above test with a numeric date value

    // Show all messages before date in the past
    const messages3: DecodedMessage[] = await aliceConversation.messages(
      undefined,
      initialQueryDate.getTime()
    )

    // Show all messages before date in the future
    const messages4: DecodedMessage[] = await aliceConversation.messages(
      undefined,
      finalQueryDate.getTime()
    )

    const passingTimestampFieldSuccessful =
      !messages3.length && messages4.length === 1

    return passingTimestampFieldSuccessful
  } catch {
    return false
  }
})

test('canMessage', async () => {
  const bob = await Client.createRandom({ env: 'local' })
  const alice = await Client.createRandom({ env: 'local' })

  const canMessage = await bob.canMessage(alice.address)
  return canMessage
})

test('createFromKeyBundle throws error for non string value', async () => {
  try {
    const bytes = [1, 2, 3]
    await Client.createFromKeyBundle(JSON.stringify(bytes), {
      env: 'local',
    })
  } catch {
    return true
  }
  return false
})

test('canPrepareMessage', async () => {
  const bob = await Client.createRandom({ env: 'local' })
  const alice = await Client.createRandom({ env: 'local' })
  await delayToPropogate()

  const bobConversation = await bob.conversations.newConversation(alice.address)
  await delayToPropogate()

  const prepared = await bobConversation.prepareMessage('hi')
  if (!prepared.preparedAt) {
    throw new Error('missing `preparedAt` on prepared message')
  }

  // Either of these should work:
  await bobConversation.sendPreparedMessage(prepared)
  // await bob.sendPreparedMessage(prepared);

  await delayToPropogate()
  const messages = await bobConversation.messages()
  if (messages.length !== 1) {
    throw new Error(`expected 1 message: got ${messages.length}`)
  }
  const message = messages[0]

  return message?.id === prepared.messageId
})

test('can list batch messages', async () => {
  const bob = await Client.createRandom({ env: 'local' })
  await delayToPropogate()
  const alice = await Client.createRandom({ env: 'local' })
  await delayToPropogate()
  if (bob.address === alice.address) {
    throw new Error('bob and alice should be different')
  }

  const bobConversation = await bob.conversations.newConversation(alice.address)
  await delayToPropogate()

  const aliceConversation = (await alice.conversations.list())[0]
  if (!aliceConversation) {
    throw new Error('aliceConversation should exist')
  }

  await bobConversation.send({ text: 'Hello world' })
  const bobMessages = await bobConversation.messages()
  await bobConversation.send({
    reaction: {
      reference: bobMessages[0].id,
      action: 'added',
      schema: 'unicode',
      content: '💖',
    },
  })

  await delayToPropogate()
  const messages: DecodedMessage[] = await alice.listBatchMessages([
    {
      contentTopic: bobConversation.topic,
    } as Query,
    {
      contentTopic: aliceConversation.topic,
    } as Query,
  ])

  if (messages.length < 1) {
    throw Error('No message')
  }

  if (messages[0].contentTypeId !== 'xmtp.org/reaction:1.0') {
    throw Error(
      'Unexpected message content ' + JSON.stringify(messages[0].contentTypeId)
    )
  }

  if (messages[0].fallback !== 'Reacted “💖” to an earlier message') {
    throw Error('Unexpected message fallback ' + messages[0].fallback)
  }

  return true
})

test('can paginate batch messages', async () => {
  const bob = await Client.createRandom({ env: 'local' })
  await delayToPropogate()
  const alice = await Client.createRandom({ env: 'local' })
  await delayToPropogate()
  if (bob.address === alice.address) {
    throw new Error('bob and alice should be different')
  }

  const bobConversation = await bob.conversations.newConversation(alice.address)
  await delayToPropogate()

  const aliceConversation = (await alice.conversations.list())[0]
  if (!aliceConversation) {
    throw new Error('aliceConversation should exist')
  }

  await bobConversation.send({ text: `Initial Message` })

  await delayToPropogate()
  const testTime = new Date()
  await delayToPropogate()

  for (let i = 0; i < 5; i++) {
    await bobConversation.send({ text: `Message ${i}` })
    await delayToPropogate()
  }

  const messagesLimited: DecodedMessage[] = await alice.listBatchMessages([
    {
      contentTopic: bobConversation.topic,
      pageSize: 2,
    } as Query,
  ])

  const messagesAfter: DecodedMessage[] = await alice.listBatchMessages([
    {
      contentTopic: bobConversation.topic,
      startTime: testTime,
      endTime: new Date(),
    } as Query,
  ])

  const messagesBefore: DecodedMessage[] = await alice.listBatchMessages([
    {
      contentTopic: bobConversation.topic,
      endTime: testTime,
    } as Query,
  ])

  await bobConversation.send('')
  await delayToPropogate()

  const messagesAsc: DecodedMessage[] = await alice.listBatchMessages([
    {
      contentTopic: bobConversation.topic,
      direction: 'SORT_DIRECTION_ASCENDING',
    } as Query,
  ])

  if (messagesLimited.length !== 2) {
    throw Error('Unexpected messagesLimited count ' + messagesLimited.length)
  }

  if (messagesLimited[0].content() !== 'Message 4') {
    throw Error(
      'Unexpected messagesLimited content ' + messagesLimited[0].content()
    )
  }
  if (messagesLimited[1].content() !== 'Message 3') {
    throw Error(
      'Unexpected messagesLimited content ' + messagesLimited[1].content()
    )
  }

  if (messagesBefore.length !== 1) {
    throw Error('Unexpected messagesBefore count ' + messagesBefore.length)
  }
  if (messagesBefore[0].content() !== 'Initial Message') {
    throw Error(
      'Unexpected messagesBefore content ' + messagesBefore[0].content()
    )
  }

  if (messagesAfter.length !== 5) {
    throw Error('Unexpected messagesAfter count ' + messagesAfter.length)
  }
  if (messagesAfter[0].content() !== 'Message 4') {
    throw Error(
      'Unexpected messagesAfter content ' + messagesAfter[0].content()
    )
  }

  if (messagesAsc[0].content() !== 'Initial Message') {
    throw Error('Unexpected messagesAsc content ' + messagesAsc[0].content())
  }

  if (messagesAsc[6].contentTypeId !== 'xmtp.org/text:1.0') {
    throw Error('Unexpected messagesAsc content ' + messagesAsc[6].content())
  }

  return true
})

test('can stream messages', async () => {
  const bob = await Client.createRandom({ env: 'local' })
  await delayToPropogate()
  const alice = await Client.createRandom({ env: 'local' })
  await delayToPropogate()

  // Record new conversation stream
  const allConversations: Conversation<any>[] = []
  await alice.conversations.stream(async (conversation) => {
    allConversations.push(conversation)
  })

  // Record message stream across all conversations
  const allMessages: DecodedMessage[] = []
  await alice.conversations.streamAllMessages(async (message) => {
    allMessages.push(message)
  })

  // Start Bob starts a new conversation.
  const bobConvo = await bob.conversations.newConversation(alice.address, {
    conversationID: 'https://example.com/alice-and-bob',
    metadata: {
      title: 'Alice and Bob',
    },
  })
  await delayToPropogate()

  if (bobConvo.clientAddress !== bob.address) {
    throw Error('Unexpected client address ' + bobConvo.clientAddress)
  }
  if (!bobConvo.topic) {
    throw Error('Missing topic ' + bobConvo.topic)
  }
  if (
    bobConvo.context?.conversationID !== 'https://example.com/alice-and-bob'
  ) {
    throw Error('Unexpected conversationID ' + bobConvo.context?.conversationID)
  }
  if (bobConvo.context?.metadata?.title !== 'Alice and Bob') {
    throw Error(
      'Unexpected metadata title ' + bobConvo.context?.metadata?.title
    )
  }
  if (!bobConvo.createdAt) {
    throw Error('Missing createdAt ' + bobConvo.createdAt)
  }

  if (allConversations.length !== 1) {
    throw Error('Unexpected all conversations count ' + allConversations.length)
  }
  if (allConversations[0].topic !== bobConvo.topic) {
    throw Error(
      'Unexpected all conversations topic ' + allConversations[0].topic
    )
  }

  const aliceConvo = (await alice.conversations.list())[0]
  if (!aliceConvo) {
    throw new Error('missing conversation')
  }

  // Record message stream for this conversation
  const convoMessages: DecodedMessage[] = []
  await aliceConvo.streamMessages(async (message) => {
    convoMessages.push(message)
  })

  for (let i = 0; i < 5; i++) {
    await bobConvo.send({ text: `Message ${i}` })
    await delayToPropogate()
  }
  if (allMessages.length !== 5) {
    throw Error('Unexpected all messages count ' + allMessages.length)
  }
  if (convoMessages.length !== 5) {
    throw Error('Unexpected convo messages count ' + convoMessages.length)
  }
  for (let i = 0; i < 5; i++) {
    if (allMessages[i].content() !== `Message ${i}`) {
      throw Error('Unexpected all message content ' + allMessages[i].content())
    }
    if (allMessages[i].topic !== bobConvo.topic) {
      throw Error('Unexpected all message topic ' + allMessages[i].topic)
    }
    if (convoMessages[i].content() !== `Message ${i}`) {
      throw Error(
        'Unexpected convo message content ' + convoMessages[i].content()
      )
    }
    if (convoMessages[i].topic !== bobConvo.topic) {
      throw Error('Unexpected convo message topic ' + convoMessages[i].topic)
    }
  }
  alice.conversations.cancelStream()
  alice.conversations.cancelStreamAllMessages()

  return true
})

test('remote attachments should work', async () => {
  const alice = await Client.createRandom({
    env: 'local',
    codecs: [new StaticAttachmentCodec(), new RemoteAttachmentCodec()],
  })
  const bob = await Client.createRandom({
    env: 'local',
    codecs: [new StaticAttachmentCodec(), new RemoteAttachmentCodec()],
  })
  const convo = await alice.conversations.newConversation(bob.address)

  // Alice is sending Bob a file from her phone.
  const filename = `${Date.now()}.txt`
  const file = `${fs.dirs.CacheDir}/${filename}`
  await fs.writeFile(file, 'hello world', 'utf8')
  const { encryptedLocalFileUri, metadata } = await alice.encryptAttachment({
    fileUri: `file://${file}`,
    mimeType: 'text/plain',
  })

  const encryptedFile = encryptedLocalFileUri.slice('file://'.length)
  const originalContent = await fs.readFile(file, 'base64')
  const encryptedContent = await fs.readFile(encryptedFile, 'base64')
  if (encryptedContent === originalContent) {
    throw new Error('encrypted file should not match original')
  }

  // This is where the app will upload the encrypted file to a remote server and generate a URL.
  //   let url = await uploadFile(encryptedLocalFileUri);
  const url = 'https://example.com/123'

  // Together with the metadata, we send the URL as a remoteAttachment message to the conversation.
  await convo.send({
    remoteAttachment: {
      ...metadata,
      scheme: 'https://',
      url,
    },
  })
  await delayToPropogate()

  // Now we should see the remote attachment message.
  const messages = await convo.messages()
  if (messages.length !== 1) {
    throw new Error('Expected 1 message')
  }
  const message = messages[0]

  if (message.contentTypeId !== 'xmtp.org/remoteStaticAttachment:1.0') {
    throw new Error('Expected correctly formatted typeId')
  }
  if (!message.content()) {
    throw new Error('Expected remoteAttachment')
  }
  if (
    (message.content() as RemoteAttachmentContent).url !==
    'https://example.com/123'
  ) {
    throw new Error('Expected url to match')
  }

  // This is where the app prompts the user to download the encrypted file from `url`.
  // TODO: let downloadedFile = await downloadFile(url);
  // But to simplify this test, we're just going to copy
  // the previously encrypted file and pretend that we just downloaded it.
  const downloadedFileUri = `file://${fs.dirs.CacheDir}/${Date.now()}.bin`
  await fs.cp(
    new URL(encryptedLocalFileUri).pathname,
    new URL(downloadedFileUri).pathname
  )

  // Now we can decrypt the downloaded file using the message metadata.
  const attached = await alice.decryptAttachment({
    encryptedLocalFileUri: downloadedFileUri,
    metadata: message.content() as RemoteAttachmentContent,
  })
  if (attached.mimeType !== 'text/plain') {
    throw new Error('Expected mimeType to match')
  }
  if (attached.filename !== filename) {
    throw new Error(`Expected ${attached.filename} to equal ${filename}`)
  }
  const text = await fs.readFile(new URL(attached.fileUri).pathname, 'utf8')
  if (text !== 'hello world') {
    throw new Error('Expected text to match')
  }
  return true
})

test('can send read receipts', async () => {
  const bob = await Client.createRandom({ env: 'local' })
  await delayToPropogate()
  const alice = await Client.createRandom({ env: 'local' })
  await delayToPropogate()
  if (bob.address === alice.address) {
    throw new Error('bob and alice should be different')
  }

  const bobConversation = await bob.conversations.newConversation(alice.address)
  await delayToPropogate()

  const aliceConversation = (await alice.conversations.list())[0]
  if (!aliceConversation) {
    throw new Error('aliceConversation should exist')
  }

  await bobConversation.send({ readReceipt: {} })

  const bobMessages = await bobConversation.messages()

  if (bobMessages.length < 1) {
    throw Error('No message')
  }

  if (bobMessages[0].contentTypeId !== 'xmtp.org/readReceipt:1.0') {
    throw Error('Unexpected message content ' + bobMessages[0].contentTypeId)
  }

  if (bobMessages[0].fallback) {
    throw Error('Unexpected message fallback ' + bobMessages[0].fallback)
  }

  return true
})

test('can stream all messages', async () => {
  const bo = await Client.createRandom({ env: 'local' })
  await delayToPropogate()
  const alix = await Client.createRandom({ env: 'local' })
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
  const caro = await Client.createRandom({ env: 'local' })
  const caroConvo = await caro.conversations.newConversation(alix.address)
  await delayToPropogate()
  for (let i = 0; i < 5; i++) {
    await caroConvo.send({ text: `Message ${i}` })
    await delayToPropogate()
  }

  if (allMessages.length !== 10) {
    throw Error('Unexpected all messages count ' + allMessages.length)
  }

  alix.conversations.cancelStreamAllMessages()

  await alix.conversations.streamAllMessages(async (message) => {
    allMessages.push(message)
  })

  for (let i = 0; i < 5; i++) {
    await boConvo.send({ text: `Message ${i}` })
    await delayToPropogate()
  }
  if (allMessages.length <= 10) {
    throw Error('Unexpected all messages count ' + allMessages.length)
  }

  return true
})

test('canManagePreferences', async () => {
  const bo = await Client.createRandom({ env: 'local' })
  const alix = await Client.createRandom({ env: 'local' })
  await delayToPropogate()

  const alixConversation = await bo.conversations.newConversation(alix.address)
  await delayToPropogate()

  const initialConvoState = await alixConversation.consentState()
  if (initialConvoState !== 'allowed') {
    throw new Error(
      `conversations created by bo should be allowed by default not ${initialConvoState}`
    )
  }

  const initialState = await bo.contacts.isAllowed(alixConversation.peerAddress)
  if (!initialState) {
    throw new Error(
      `contacts created by bo should be allowed by default not ${initialState}`
    )
  }

  await bo.contacts.deny([alixConversation.peerAddress])
  await delayToPropogate()

  const deniedState = await bo.contacts.isDenied(alixConversation.peerAddress)
  const allowedState = await bo.contacts.isAllowed(alixConversation.peerAddress)
  if (!deniedState) {
    throw new Error(`contacts denied by bo should be denied not ${deniedState}`)
  }

  if (allowedState) {
    throw new Error(
      `contacts denied by bo should be denied not ${allowedState}`
    )
  }

  const convoState = await alixConversation.consentState()
  await delayToPropogate()

  if (convoState !== 'denied') {
    throw new Error(
      `conversations denied by bo should be denied not ${convoState}`
    )
  }

  const boConsentList = await bo.contacts.consentList()
  await delayToPropogate()

  if (boConsentList.length !== 1) {
    throw new Error(`consent list for bo should 1 not ${boConsentList.length}`)
  }

  const boConsentListState = boConsentList[0].permissionType

  if (boConsentListState !== 'denied') {
    throw new Error(
      `conversations denied by bo should be denied in consent list not ${boConsentListState}`
    )
  }

  return true
})

test('is address on the XMTP network', async () => {
  const alix = await Client.createRandom({ env: 'local' })
  const notOnNetwork = '0x0000000000000000000000000000000000000000'

  const isAlixAddressAvailable = await Client.canMessage(alix.address, {
    env: 'local',
  })
  const isAddressAvailable = await Client.canMessage(notOnNetwork, {
    env: 'local',
  })

  if (!isAlixAddressAvailable) {
    throw new Error('alix address should be available')
  }

  if (isAddressAvailable) {
    throw new Error('address not on network should not be available')
  }

  return true
})

test('register and use custom content types', async () => {
  const bob = await Client.createRandom({
    env: 'local',
    codecs: [new NumberCodec()],
  })
  const alice = await Client.createRandom({
    env: 'local',
    codecs: [new NumberCodec()],
  })

  bob.register(new NumberCodec())
  alice.register(new NumberCodec())

  const bobConvo = await bob.conversations.newConversation(alice.address)
  const aliceConvo = await alice.conversations.newConversation(bob.address)

  await bobConvo.send(12, { contentType: ContentTypeNumber })

  const messages = await aliceConvo.messages()
  assert(messages.length === 1, 'did not get messages')

  const message = messages[0]
  const messageContent = message.content()

  assert(
     messageContent === 12,
    'did not get content properly: ' + JSON.stringify(messageContent)
  )

  return true
})

test('register and use custom content types when preparing message', async () => {
  const bob = await Client.createRandom({
    env: 'local',
    codecs: [new NumberCodec()],
  })
  const alice = await Client.createRandom({
    env: 'local',
    codecs: [new NumberCodec()],
  })

  bob.register(new NumberCodec())
  alice.register(new NumberCodec())

  const bobConvo = await bob.conversations.newConversation(alice.address)
  const aliceConvo = await alice.conversations.newConversation(bob.address)

  const prepped = await bobConvo.prepareMessage(
    { topNumber: { bottomNumber: 12 } },
    {
      contentType: ContentTypeNumber,
    }
  )

  await bobConvo.sendPreparedMessage(prepped)

  const messages = await aliceConvo.messages()
  assert(messages.length === 1, 'did not get messages')

  const message = messages[0]
  const messageContent = message.content() as NumberRef

  assert(
    messageContent.topNumber.bottomNumber === 12,
    'did not get content properly: ' + JSON.stringify(messageContent)
  )

  return true
})

test('calls preCreateIdentityCallback when supplied', async () => {
  let isCallbackCalled = false
  const preCreateIdentityCallback = () => {
    isCallbackCalled = true
  }
  await Client.createRandom({
    env: 'local',
    preCreateIdentityCallback,
  })

  if (!isCallbackCalled) {
    throw new Error('preCreateIdentityCallback not called')
  }

  return isCallbackCalled
})

test('calls preEnableIdentityCallback when supplied', async () => {
  let isCallbackCalled = false
  const preEnableIdentityCallback = () => {
    isCallbackCalled = true
  }
  await Client.createRandom({
    env: 'local',
    preEnableIdentityCallback,
  })

  if (!isCallbackCalled) {
    throw new Error('preEnableIdentityCallback not called')
  }

  return isCallbackCalled
})

test('returns keyMaterial for conversations', async () => {
  const bob = await Client.createRandom({ env: 'local' })
  await delayToPropogate()
  const alice = await Client.createRandom({ env: 'local' })
  await delayToPropogate()
  if (bob.address === alice.address) {
    throw new Error('bob and alice should be different')
  }

  const bobConversation = await bob.conversations.newConversation(alice.address)
  await delayToPropogate()

  const aliceConversation = (await alice.conversations.list())[0]
  if (!aliceConversation) {
    throw new Error('aliceConversation should exist')
  }

  if (!aliceConversation.keyMaterial) {
    throw new Error('aliceConversation keyMaterial should exist')
  }

  if (!bobConversation.keyMaterial) {
    throw new Error('bobConversation keyMaterial should exist')
  }

  return true
})

test('correctly handles lowercase addresses', async () => {
  const bob = await Client.createRandom({ env: 'local' })
  await delayToPropogate()
  const alice = await Client.createRandom({ env: 'local' })
  await delayToPropogate()
  if (bob.address === alice.address) {
    throw new Error('bob and alice should be different')
  }

  const bobConversation = await bob.conversations.newConversation(
    alice.address.toLocaleLowerCase()
  )
  await delayToPropogate()
  if (!bobConversation) {
    throw new Error('bobConversation should exist')
  }
  const aliceConversation = (await alice.conversations.list())[0]
  if (!aliceConversation) {
    throw new Error('aliceConversation should exist')
  }

  await bob.contacts.deny([aliceConversation.peerAddress.toLocaleLowerCase()])
  await delayToPropogate()
  const deniedState = await bob.contacts.isDenied(aliceConversation.peerAddress)
  const allowedState = await bob.contacts.isAllowed(
    aliceConversation.peerAddress
  )
  if (!deniedState) {
    throw new Error(`contacts denied by bo should be denied not ${deniedState}`)
  }

  if (allowedState) {
    throw new Error(
      `contacts denied by bo should be denied not ${allowedState}`
    )
  }
  const deniedLowercaseState = await bob.contacts.isDenied(
    aliceConversation.peerAddress.toLocaleLowerCase()
  )
  const allowedLowercaseState = await bob.contacts.isAllowed(
    aliceConversation.peerAddress.toLocaleLowerCase()
  )
  if (!deniedLowercaseState) {
    throw new Error(
      `contacts denied by bo should be denied not ${deniedLowercaseState}`
    )
  }

  if (allowedLowercaseState) {
    throw new Error(
      `contacts denied by bo should be denied not ${allowedLowercaseState}`
    )
  }
  return true
})
