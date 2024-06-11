import { FramesClient } from '@xmtp/frames-client'
import { content, invitation } from '@xmtp/proto'
import { createHmac } from 'crypto'
import { ethers } from 'ethers'
import ReactNativeBlobUtil from 'react-native-blob-util'
import Config from 'react-native-config'
import { TextEncoder, TextDecoder } from 'text-encoding'
import { PrivateKeyAccount } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { DecodedMessage } from 'xmtp-react-native-sdk/lib/DecodedMessage'

import { Test, assert, createClients, delayToPropogate } from './test-utils'
import {
  Query,
  JSContentCodec,
  Client,
  Conversation,
  StaticAttachmentCodec,
  RemoteAttachmentCodec,
  RemoteAttachmentContent,
  Signer,
} from '../../../src/index'

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

const LONG_STREAM_DELAY = 20000

export const tests: Test[] = []

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const hkdfNoSalt = new ArrayBuffer(0)

async function hkdfHmacKey(
  secret: Uint8Array,
  info: Uint8Array
): Promise<CryptoKey> {
  const key = await window.crypto.subtle.importKey(
    'raw',
    secret,
    'HKDF',
    false,
    ['deriveKey']
  )
  return await window.crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: hkdfNoSalt, info },
    key,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true,
    ['sign', 'verify']
  )
}

export async function importHmacKey(key: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  )
}

async function generateHmacSignature(
  secret: Uint8Array,
  info: Uint8Array,
  message: Uint8Array
): Promise<Uint8Array> {
  const key = await hkdfHmacKey(secret, info)
  const signed = await window.crypto.subtle.sign('HMAC', key, message)
  return new Uint8Array(signed)
}

function base64ToUint8Array(base64String: string): Uint8Array {
  const buffer = Buffer.from(base64String, 'base64')
  return new Uint8Array(buffer)
}

function verifyHmacSignature(
  key: Uint8Array,
  signature: Uint8Array,
  message: Uint8Array
): boolean {
  const hmac = createHmac('sha256', Buffer.from(key))

  hmac.update(message)

  const calculatedSignature = hmac.digest()
  const result = Buffer.compare(calculatedSignature, signature) === 0

  return result
}

async function exportHmacKey(key: CryptoKey): Promise<Uint8Array> {
  const exported = await window.crypto.subtle.exportKey('raw', key)
  return new Uint8Array(exported)
}

function test(name: string, perform: () => Promise<boolean>) {
  tests.push({ name, run: perform })
}

test('can make a client', async () => {
  const [client] = await createClients(1)

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

export function convertPrivateKeyAccountToSigner(
  privateKeyAccount: PrivateKeyAccount
): Signer {
  if (!privateKeyAccount.address) {
    throw new Error('WalletClient is not configured')
  }

  return {
    getAddress: async () => privateKeyAccount.address,
    signMessage: async (message: string | Uint8Array) =>
      privateKeyAccount.signMessage({
        message: typeof message === 'string' ? message : { raw: message },
      }),
  }
}

test('can load a client from env "2k lens convos" private key', async () => {
  if (!Config.TEST_PRIVATE_KEY) {
    throw new Error('Add private key to .env file')
  }
  const privateKeyHex: `0x${string}` = `0x${Config.TEST_PRIVATE_KEY}`

  const signer = convertPrivateKeyAccountToSigner(
    privateKeyToAccount(privateKeyHex)
  )
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const xmtpClient = await Client.create(signer, {
    env: 'local',
    dbEncryptionKey: key,
  })

  assert(
    xmtpClient.address === '0x209fAEc92D9B072f3E03d6115002d6652ef563cd',
    'Address: ' + xmtpClient.address
  )
  return true
})

test('can load 1995 conversations from dev network "2k lens convos" account', async () => {
  if (!Config.TEST_PRIVATE_KEY) {
    throw new Error('Add private key to .env file')
  }

  const privateKeyHex: `0x${string}` = `0x${Config.TEST_PRIVATE_KEY}`
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  const signer = convertPrivateKeyAccountToSigner(
    privateKeyToAccount(privateKeyHex)
  )
  const xmtpClient = await Client.create(signer, {
    env: 'dev',
    dbEncryptionKey: key,
  })

  assert(
    xmtpClient.address === '0x209fAEc92D9B072f3E03d6115002d6652ef563cd',
    'Address: ' + xmtpClient.address
  )
  const start = Date.now()
  const conversations = await xmtpClient.conversations.list()
  const end = Date.now()
  console.log(
    `Loaded ${conversations.length} conversations in ${end - start}ms`
  )
  assert(
    conversations.length === 1995,
    'Conversations: ' + conversations.length
  )

  return true
})

test('can pass a custom filter date and receive message objects with expected dates', async () => {
  try {
    const [bob, alice] = await createClients(2)

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
  const [bo, alix] = await createClients(2)

  const canMessage = await bo.canMessage(alix.address)
  if (!canMessage) {
    throw new Error('should be able to message v2 client')
  }

  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  const caro = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
    dbEncryptionKey: keyBytes,
  })
  const chux = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
    dbEncryptionKey: keyBytes,
  })

  const canMessageV3 = await caro.canGroupMessage([chux.address])
  if (!canMessageV3) {
    throw new Error('should be able to message v3 client')
  }
  return true
})

test('fetch a public key bundle and sign a digest', async () => {
  const [bob] = await createClients(1)
  const bytes = new Uint8Array([1, 2, 3])
  const signature = await bob.sign(bytes, { kind: 'identity' })
  if (signature.length === 0) {
    throw new Error('signature was not returned')
  }
  const keyBundle = await bob.exportPublicKeyBundle()
  if (keyBundle.length === 0) {
    throw new Error('key bundle was not returned')
  }
  return true
})

test('createFromKeyBundle throws error for non string value', async () => {
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  try {
    const bytes = [1, 2, 3]
    await Client.createFromKeyBundle(JSON.stringify(bytes), {
      env: 'local',
      dbEncryptionKey: key,
    })
  } catch {
    return true
  }
  return false
})

test('canPrepareMessage', async () => {
  const [bob, alice] = await createClients(2)

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
  const [bob, alice] = await createClients(2)
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
  const [bob, alice] = await createClients(2)
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
  const [bob, alice] = await createClients(2)
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

  if (bobConvo.client.address !== bob.address) {
    throw Error('Unexpected client address ' + bobConvo.client.address)
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

test('can stream conversations with delay', async () => {
  const [bo, alix] = await createClients(2)
  await delayToPropogate()

  const allConvos: Conversation<any>[] = []
  await alix.conversations.stream(async (convo) => {
    allConvos.push(convo)
  })

  await bo.conversations.newConversation(alix.address)
  await delayToPropogate()

  await bo.conversations.newConversation(alix.address, {
    conversationID: 'convo-2',
    metadata: {},
  })
  await delayToPropogate()

  assert(
    allConvos.length === 2,
    'Unexpected all convos count ' + allConvos.length
  )

  await sleep(LONG_STREAM_DELAY)

  await bo.conversations.newConversation(alix.address, {
    conversationID: 'convo-3',
    metadata: {},
  })
  await delayToPropogate()

  assert(
    allConvos.length === 3,
    'Unexpected all convos count ' + allConvos.length
  )

  alix.conversations.cancelStream()
  return true
})

test('remote attachments should work', async () => {
  const [bob, alice] = await createClients(2)
  alice.register(new StaticAttachmentCodec())
  alice.register(new RemoteAttachmentCodec())
  bob.register(new StaticAttachmentCodec())
  bob.register(new RemoteAttachmentCodec())

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
  const [bob, alice] = await createClients(2)
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
  const [bo, alix, caro] = await createClients(3)
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

test('can stream all msgs with delay', async () => {
  const [bo, alix, caro] = await createClients(3)
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

  assert(
    allMessages.length === 5,
    'Unexpected all messages count ' + allMessages.length
  )

  await sleep(LONG_STREAM_DELAY)
  // Starts a new conversation.
  const caroConvo = await caro.conversations.newConversation(alix.address)
  await delayToPropogate()

  for (let i = 0; i < 5; i++) {
    await caroConvo.send({ text: `Message ${i}` })
    await delayToPropogate()
  }

  assert(
    allMessages.length === 10,
    'Unexpected all messages count ' + allMessages.length
  )

  await sleep(LONG_STREAM_DELAY)

  for (let i = 0; i < 5; i++) {
    await boConvo.send({ text: `Message ${i}` })
    await delayToPropogate()
  }

  assert(
    allMessages.length === 15,
    'Unexpected all messages count ' + allMessages.length
  )

  alix.conversations.cancelStreamAllMessages()

  return true
})

test('canManagePreferences', async () => {
  const [bo, alix] = await createClients(2)
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
  const [alix] = await createClients(1)
  const notOnNetwork = '0x0000000000000000000000000000000000000000'
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  const isAlixAddressAvailable = await Client.canMessage(alix.address, {
    env: 'local',
    dbEncryptionKey: key,
  })
  const isAddressAvailable = await Client.canMessage(notOnNetwork, {
    env: 'local',
    dbEncryptionKey: key,
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
  const [bob, alice] = await createClients(2)
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

test('register and use custom content types when preparing message', async () => {
  const [bob, alice] = await createClients(2)

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
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  await Client.createRandom({
    env: 'local',
    preCreateIdentityCallback,
    dbEncryptionKey: key,
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
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  await Client.createRandom({
    env: 'local',
    preEnableIdentityCallback,
    dbEncryptionKey: key,
  })

  if (!isCallbackCalled) {
    throw new Error('preEnableIdentityCallback not called')
  }

  return isCallbackCalled
})

test('returns keyMaterial for conversations', async () => {
  const [bob, alice] = await createClients(2)
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
  const [bob, alice] = await createClients(2)
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

test('handle fallback types appropriately', async () => {
  const [bob, alice] = await await createClients(2)
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

test('instantiate frames client correctly', async () => {
  const frameUrl =
    'https://fc-polls-five.vercel.app/polls/01032f47-e976-42ee-9e3d-3aac1324f4b8'
  const [client] = await createClients(1)
  const framesClient = new FramesClient(client)
  const metadata = await framesClient.proxy.readMetadata(frameUrl)
  if (!metadata) {
    throw new Error('metadata should exist')
  }
  const signedPayload = await framesClient.signFrameAction({
    frameUrl,
    buttonIndex: 1,
    conversationTopic: 'foo',
    participantAccountAddresses: ['amal', 'bola'],
  })
  const postUrl = metadata.extractedTags['fc:frame:post_url']
  const response = await framesClient.proxy.post(postUrl, signedPayload)
  if (!response) {
    throw new Error('response should exist')
  }
  if (response.extractedTags['fc:frame'] !== 'vNext') {
    throw new Error('response should have expected extractedTags')
  }
  const imageUrl = response.extractedTags['fc:frame:image']
  const mediaUrl = framesClient.proxy.mediaUrl(imageUrl)

  const downloadedMedia = await fetch(mediaUrl)
  if (!downloadedMedia.ok) {
    throw new Error('downloadedMedia should be ok')
  }
  if (downloadedMedia.headers.get('content-type') !== 'image/png') {
    throw new Error('downloadedMedia should be image/png')
  }
  return true
})

// Skipping this test as it's not something supported right now
test('can stream all conversation Messages from multiple clients', async () => {
  const [alix, bo, caro] = await createClients(3)

  if (bo.address === alix.address) {
    throw Error('Bo and Alix should have different addresses')
  }
  if (bo.address === caro.address) {
    throw Error('Bo and Caro should have different addresses')
  }
  if (alix.address === caro.address) {
    throw Error('Alix and Caro should have different addresses')
  }

  // Setup stream
  const allAlixMessages: DecodedMessage<any>[] = []
  const allBoMessages: DecodedMessage<any>[] = []
  const alixConvo = await caro.conversations.newConversation(alix.address)
  const boConvo = await caro.conversations.newConversation(bo.address)

  await alixConvo.streamMessages(async (message) => {
    allAlixMessages.push(message)
  })
  await boConvo.streamMessages(async (message) => {
    allBoMessages.push(message)
  })

  // Start Caro starts a new conversation.
  await delayToPropogate()
  await alixConvo.send({ text: `Message` })
  await delayToPropogate()
  if (allBoMessages.length !== 0) {
    throw Error(
      'Unexpected all conversations count for Bo ' + allBoMessages.length
    )
  }

  if (allAlixMessages.length !== 1) {
    throw Error(
      'Unexpected all conversations count for Alix ' + allAlixMessages.length
    )
  }

  const alixConv = (await alix.conversations.list())[0]
  await alixConv.send({ text: `Message` })
  await delayToPropogate()
  if (allBoMessages.length !== 0) {
    throw Error(
      'Unexpected all conversations count for Bo ' + allBoMessages.length
    )
  }
  // @ts-ignore-next-line
  if (allAlixMessages.length !== 2) {
    throw Error(
      'Unexpected all conversations count for Alix ' + allAlixMessages.length
    )
  }

  return true
})

test('can stream all conversation Messages from multiple clients - swapped', async () => {
  const [alix, bo, caro] = await createClients(3)

  if (bo.address === alix.address) {
    throw Error('Bo and Alix should have different addresses')
  }
  if (bo.address === caro.address) {
    throw Error('Bo and Caro should have different addresses')
  }
  if (alix.address === caro.address) {
    throw Error('Alix and Caro should have different addresses')
  }

  // Setup stream
  const allAlixMessages: DecodedMessage<any>[] = []
  const allBoMessages: DecodedMessage<any>[] = []
  const alixConvo = await caro.conversations.newConversation(alix.address)
  const boConvo = await caro.conversations.newConversation(bo.address)

  await boConvo.streamMessages(async (message) => {
    allBoMessages.push(message)
  })
  await alixConvo.streamMessages(async (message) => {
    allAlixMessages.push(message)
  })

  // Start Caro starts a new conversation.
  await delayToPropogate()
  await alixConvo.send({ text: `Message` })
  await delayToPropogate()
  if (allBoMessages.length !== 0) {
    throw Error(
      'Unexpected all conversations count for Bo ' + allBoMessages.length
    )
  }

  if (allAlixMessages.length !== 1) {
    throw Error(
      'Unexpected all conversations count for Alix ' + allAlixMessages.length
    )
  }

  const alixConv = (await alix.conversations.list())[0]
  await alixConv.send({ text: `Message` })
  await delayToPropogate()
  if (allBoMessages.length !== 0) {
    throw Error(
      'Unexpected all conversations count for Bo ' + allBoMessages.length
    )
  }
  // @ts-ignore-next-line
  if (allAlixMessages.length !== 2) {
    throw Error(
      'Unexpected all conversations count for Alix ' + allAlixMessages.length
    )
  }

  return true
})

test('generates and validates HMAC', async () => {
  const secret = crypto.getRandomValues(new Uint8Array(32))
  const info = crypto.getRandomValues(new Uint8Array(32))
  const message = crypto.getRandomValues(new Uint8Array(32))
  const hmac = await generateHmacSignature(secret, info, message)
  const key = await hkdfHmacKey(secret, info)
  const valid = await verifyHmacSignature(
    await exportHmacKey(key),
    hmac,
    message
  )
  return valid
})

test('generates and validates HMAC with imported key', async () => {
  const secret = crypto.getRandomValues(new Uint8Array(32))
  const info = crypto.getRandomValues(new Uint8Array(32))
  const message = crypto.getRandomValues(new Uint8Array(32))
  const hmac = await generateHmacSignature(secret, info, message)
  const key = await hkdfHmacKey(secret, info)
  const exportedKey = await exportHmacKey(key)
  const importedKey = await importHmacKey(exportedKey)
  const valid = await verifyHmacSignature(
    await exportHmacKey(importedKey),
    hmac,
    message
  )
  return valid
})

test('generates different HMAC keys with different infos', async () => {
  const secret = crypto.getRandomValues(new Uint8Array(32))
  const info1 = crypto.getRandomValues(new Uint8Array(32))
  const info2 = crypto.getRandomValues(new Uint8Array(32))
  const key1 = await hkdfHmacKey(secret, info1)
  const key2 = await hkdfHmacKey(secret, info2)

  const exported1 = await exportHmacKey(key1)
  const exported2 = await exportHmacKey(key2)
  return exported1 !== exported2
})

test('fails to validate HMAC with wrong message', async () => {
  const secret = crypto.getRandomValues(new Uint8Array(32))
  const info = crypto.getRandomValues(new Uint8Array(32))
  const message = crypto.getRandomValues(new Uint8Array(32))
  const hmac = await generateHmacSignature(secret, info, message)
  const key = await hkdfHmacKey(secret, info)
  const valid = await verifyHmacSignature(
    await exportHmacKey(key),
    hmac,
    crypto.getRandomValues(new Uint8Array(32))
  )
  return !valid
})

test('fails to validate HMAC with wrong key', async () => {
  const secret = crypto.getRandomValues(new Uint8Array(32))
  const info = crypto.getRandomValues(new Uint8Array(32))
  const message = crypto.getRandomValues(new Uint8Array(32))
  const hmac = await generateHmacSignature(secret, info, message)
  const valid = await verifyHmacSignature(
    await exportHmacKey(
      await hkdfHmacKey(
        crypto.getRandomValues(new Uint8Array(32)),
        crypto.getRandomValues(new Uint8Array(32))
      )
    ),
    hmac,
    message
  )
  return !valid
})

test('get all HMAC keys', async () => {
  const [alice] = await createClients(1)

  const conversations: Conversation<any>[] = []

  for (let i = 0; i < 5; i++) {
    const [client] = await createClients(1)
    const convo = await alice.conversations.newConversation(client.address, {
      conversationID: `https://example.com/${i}`,
      metadata: {
        title: `Conversation ${i}`,
      },
    })
    conversations.push(convo)
  }
  const thirtyDayPeriodsSinceEpoch = Math.floor(
    Date.now() / 1000 / 60 / 60 / 24 / 30
  )

  const periods = [
    thirtyDayPeriodsSinceEpoch - 1,
    thirtyDayPeriodsSinceEpoch,
    thirtyDayPeriodsSinceEpoch + 1,
  ]
  const { hmacKeys } = await alice.conversations.getHmacKeys()

  const topics = Object.keys(hmacKeys)
  conversations.forEach((conversation) => {
    assert(topics.includes(conversation.topic), 'topic not found')
  })

  const topicHmacs: {
    [topic: string]: Uint8Array
  } = {}
  const headerBytes = crypto.getRandomValues(new Uint8Array(10))

  for (const conversation of conversations) {
    const topic = conversation.topic

    const keyMaterial = conversation.keyMaterial!
    const info = `${thirtyDayPeriodsSinceEpoch}-${alice.address}`
    const hmac = await generateHmacSignature(
      base64ToUint8Array(keyMaterial),
      new TextEncoder().encode(info),
      headerBytes
    )

    topicHmacs[topic] = hmac
  }

  await Promise.all(
    Object.keys(hmacKeys).map(async (topic) => {
      const hmacData = hmacKeys[topic]

      await Promise.all(
        hmacData.values.map(
          async ({ hmacKey, thirtyDayPeriodsSinceEpoch }, idx) => {
            assert(
              thirtyDayPeriodsSinceEpoch === periods[idx],
              'periods not equal'
            )
            const valid = await verifyHmacSignature(
              hmacKey,
              topicHmacs[topic],
              headerBytes
            )
            assert(valid === (idx === 1), 'key is not valid')
          }
        )
      )
    })
  )

  return true
})

test('can handle complex streaming setup', async () => {
  const [bo, alix] = await createClients(2)
  await delayToPropogate()

  const allConvos: Conversation<any>[] = []
  await alix.conversations.stream(async (convo) => {
    allConvos.push(convo)
  })
  const allMessages: DecodedMessage[] = []
  await alix.conversations.streamAllMessages(async (message) => {
    allMessages.push(message)
  })

  const conv1 = await bo.conversations.newConversation(alix.address)
  await delayToPropogate()

  await bo.conversations.newConversation(alix.address, {
    conversationID: 'convo-2',
    metadata: {},
  })
  const allConvMessages: DecodedMessage[] = []
  await conv1.streamMessages(async (message) => {
    allConvMessages.push(message)
  })
  await conv1.send({ text: 'Hello' })
  await delayToPropogate()

  assert(
    allConvos.length === 2,
    'Unexpected all convos count1 ' + allConvos.length
  )

  assert(
    allMessages.length === 1,
    'Unexpected all messages count2 ' + allMessages.length
  )

  assert(
    allConvMessages.length === 1,
    'Unexpected all conv messages count3 ' + allConvMessages.length
  )

  await sleep(LONG_STREAM_DELAY)
  const conv3 = await bo.conversations.newConversation(alix.address, {
    conversationID: 'convo-3',
    metadata: {},
  })
  const allConv3Messages: DecodedMessage[] = []
  await conv3.streamMessages(async (message) => {
    allConv3Messages.push(message)
  })
  await conv1.send({ text: 'Hello' })
  await conv3.send({ text: 'Hello' })
  await delayToPropogate()

  assert(
    allConvos.length === 3,
    'Unexpected all convos count4 ' + allConvos.length
  )

  assert(
    allMessages.length === 2, // TODO: should be 3
    'Unexpected all messages count5 ' + allMessages.length
  )

  assert(
    allConvMessages.length === 2,
    'Unexpected all conv messages count6 ' + allConvMessages.length
  )

  assert(
    allConv3Messages.length === 1,
    'Unexpected all conv3 messages count7 ' + allConv3Messages.length
  )

  alix.conversations.cancelStream()
  alix.conversations.cancelStreamAllMessages()

  await bo.conversations.newConversation(alix.address, {
    conversationID: 'convo-4',
    metadata: {},
  })
  await conv3.send({ text: 'Hello' })

  assert(
    allConvos.length === 3,
    'Unexpected all convos count8 ' + allConvos.length
  )

  assert(
    allMessages.length === 3,
    'Unexpected all messages count9 ' + allMessages.length
  )

  assert(
    allConvMessages.length === 2,
    'Unexpected all conv messages count10 ' + allConvMessages.length
  )

  assert(
    allConv3Messages.length === 2,
    'Unexpected all conv3 messages count11 ' + allConv3Messages.length
  )

  return true
})

test('can handle complex streaming setup with messages from self', async () => {
  const [bo, alix] = await createClients(2)
  await delayToPropogate()

  const allConvos: Conversation<any>[] = []
  await alix.conversations.stream(async (convo) => {
    allConvos.push(convo)
  })
  const allMessages: DecodedMessage[] = []
  await alix.conversations.streamAllMessages(async (message) => {
    allMessages.push(message)
  })

  const conv1 = await alix.conversations.newConversation(bo.address)
  await delayToPropogate()

  await alix.conversations.newConversation(bo.address, {
    conversationID: 'convo-2',
    metadata: {},
  })
  const allConvMessages: DecodedMessage[] = []
  await conv1.streamMessages(async (message) => {
    allConvMessages.push(message)
  })
  await conv1.send({ text: 'Hello' })
  await delayToPropogate()

  assert(
    allConvos.length === 2,
    'Unexpected all convos count1 ' + allConvos.length
  )

  assert(
    allMessages.length === 1,
    'Unexpected all messages count2 ' + allMessages.length
  )

  assert(
    allConvMessages.length === 1,
    'Unexpected all conv messages count3 ' + allConvMessages.length
  )

  await sleep(LONG_STREAM_DELAY)
  const conv3 = await alix.conversations.newConversation(bo.address, {
    conversationID: 'convo-3',
    metadata: {},
  })
  const allConv3Messages: DecodedMessage[] = []
  await conv3.streamMessages(async (message) => {
    allConv3Messages.push(message)
  })
  await conv1.send({ text: 'Hello' })
  await conv3.send({ text: 'Hello' })
  await delayToPropogate()

  assert(
    allConvos.length === 3,
    'Unexpected all convos count4 ' + allConvos.length
  )

  assert(
    allMessages.length === 2, // TODO: should be 3
    'Unexpected all messages count5 ' + allMessages.length
  )

  assert(
    allConvMessages.length === 3,
    'Unexpected all conv messages count6 ' + allConvMessages.length
  )

  assert(
    allConv3Messages.length === 1,
    'Unexpected all conv3 messages count7 ' + allConv3Messages.length
  )

  alix.conversations.cancelStream()
  alix.conversations.cancelStreamAllMessages()

  await bo.conversations.newConversation(alix.address, {
    conversationID: 'convo-4',
    metadata: {},
  })
  await conv3.send({ text: 'Hello' })

  assert(
    allConvos.length === 3,
    'Unexpected all convos count8 ' + allConvos.length
  )

  assert(
    allMessages.length === 3,
    'Unexpected all messages count9 ' + allMessages.length
  )

  assert(
    allConvMessages.length === 2,
    'Unexpected all conv messages count10 ' + allConvMessages.length
  )

  assert(
    allConv3Messages.length === 2,
    'Unexpected all conv3 messages count11 ' + allConv3Messages.length
  )

  return true
})

test('can send and receive consent proofs', async () => {
  const alixWallet = await ethers.Wallet.createRandom()
  const boWallet = await ethers.Wallet.createRandom()
  const bo = await Client.create(boWallet, { env: 'local' })
  await delayToPropogate()
  const alix = await Client.create(alixWallet, { env: 'local' })
  await delayToPropogate()

  const timestamp = Date.now()
  const consentMessage =
    'XMTP : Grant inbox consent to sender\n' +
    '\n' +
    `Current Time: ${new Date(timestamp).toUTCString()}\n` +
    `From Address: ${bo.address}\n` +
    '\n' +
    'For more info: https://xmtp.org/signatures/'
  const sig = await alixWallet.signMessage(consentMessage)
  const consentProof = invitation.ConsentProofPayload.fromPartial({
    payloadVersion:
      invitation.ConsentProofPayloadVersion.CONSENT_PROOF_PAYLOAD_VERSION_1,
    signature: sig,
    timestamp,
  })

  const boConvo = await bo.conversations.newConversation(
    alix.address,
    undefined,
    consentProof
  )
  await delayToPropogate()
  assert(!!boConvo?.consentProof, 'bo consentProof should exist')
  const convos = await alix.conversations.list()
  const alixConvo = convos.find((convo) => convo.topic === boConvo.topic)
  await delayToPropogate()
  assert(!!alixConvo?.consentProof, ' alix consentProof should not exist')
  await delayToPropogate()
  await alix.contacts.refreshConsentList()
  const isAllowed = await alix.contacts.isAllowed(bo.address)
  assert(isAllowed, 'bo should be allowed')
  return true
})

test('can start conversations without consent proofs', async () => {
  const bo = await Client.createRandom({ env: 'local' })
  await delayToPropogate()
  const alix = await Client.createRandom({ env: 'local' })
  await delayToPropogate()

  const boConvo = await bo.conversations.newConversation(alix.address)
  await delayToPropogate()
  assert(!boConvo.consentProof, 'consentProof should not exist')
  const alixConvo = (await alix.conversations.list())[0]
  await delayToPropogate()
  assert(!alixConvo.consentProof, 'consentProof should not exist')
  await delayToPropogate()
  return true
})
