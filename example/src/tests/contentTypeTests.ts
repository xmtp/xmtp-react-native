import ReactNativeBlobUtil from 'react-native-blob-util'

import { Test, assert, createClients, delayToPropogate } from './test-utils'
import { ReactionContent, RemoteAttachmentContent } from '../../../src/index'
const { fs } = ReactNativeBlobUtil

export const contentTypeTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  contentTypeTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('can fetch messages with reactions', async () => {
  const [alix, bo] = await createClients(2)

  // Create group and sync
  const group = await alix.conversations.newGroup([bo.address])
  await bo.conversations.sync()
  const boGroup = await bo.conversations.findGroup(group.id)

  // Send 3 messages from alix
  await group.send('message 1')
  await group.send('message 2')
  await group.send('message 3')

  await delayToPropogate()
  await boGroup?.sync()

  // Get messages to react to
  const messages = await boGroup?.messages()
  assert(messages?.length === 3, 'Should have 3 messages')

  // Bo sends reactions to first two messages
  await boGroup?.send({
    reaction: {
      action: 'added',
      content: '👍',
      reference: messages![0].id,
      schema: 'unicode',
    },
  })

  await boGroup?.send({
    reaction: {
      action: 'added',
      content: '❤️',
      reference: messages![1].id,
      schema: 'unicode',
    },
  })

  await delayToPropogate()
  await group.sync()

  // Get regular messages
  const regularMessages = await group.messages()
  assert(
    regularMessages.length === 6,
    'Should have 5 total messages including reactions, but got ' +
      regularMessages.length
  )

  // Get messages with reactions
  const messagesWithReactions = await group.messagesWithReactions()
  assert(messagesWithReactions.length === 4, 'Should have 4 original messages')

  // Check reactions are attached to correct messages
  const firstMessage = messagesWithReactions[0] // Reverse chronological
  const secondMessage = messagesWithReactions[1]
  const thirdMessage = messagesWithReactions[2]

  assert(
    firstMessage.childMessages?.length === 1,
    'First message should have 1 reaction'
  )
  let messageType = firstMessage.childMessages![0].contentTypeId
  assert(
    messageType === 'xmtp.org/reaction:1.0',
    'First message should have reaction type, but got ' + messageType
  )
  let messageContent: ReactionContent =
    firstMessage.childMessages![0].content() as ReactionContent
  assert(
    messageContent.content === '👍',
    'First message should have thumbs up, but got ' + messageContent.content
  )

  assert(
    secondMessage.childMessages?.length === 1,
    'Second message should have 1 reaction'
  )
  messageType = secondMessage.childMessages![0].contentTypeId
  assert(
    messageType === 'xmtp.org/reaction:1.0',
    'Second message should have reaction type, but got ' + messageType
  )
  messageContent = secondMessage.childMessages![0].content() as ReactionContent
  assert(
    messageContent.content === '❤️',
    'Second message should have heart, but got ' + messageContent.content
  )

  assert(
    !thirdMessage.childMessages?.length,
    'Third message should have no reactions'
  )

  return true
})

test('can use reaction v2 from rust/proto', async () => {
  const [alix, bo] = await createClients(2)

  // Create group and sync
  const group = await alix.conversations.newGroup([bo.address])
  await bo.conversations.sync()
  const boGroup = await bo.conversations.findGroup(group.id)

  // Send 3 messages from alix
  await group.send('message 1')
  await group.send('message 2')
  await group.send('message 3')

  await delayToPropogate()
  await boGroup?.sync()

  // Get messages to react to
  const messages = await boGroup?.messages()
  assert(messages?.length === 3, 'Should have 3 messages')

  // Bo sends reaction V2 to first two messages
  await boGroup?.send({
    reactionV2: {
      action: 'added',
      content: '👍',
      reference: messages![0].id,
      schema: 'unicode',
    },
  })

  await boGroup?.send({
    reactionV2: {
      action: 'added',
      content: '❤️',
      reference: messages![1].id,
      schema: 'unicode',
    },
  })

  await delayToPropogate()
  await group.sync()

  // Get regular messages
  const regularMessages = await group.messages()
  assert(
    regularMessages.length === 6,
    'Should have 6 total messages including reactions, but got ' +
      regularMessages.length
  )

  // Get messages with reactions
  const messagesWithReactions = await group.messagesWithReactions()
  assert(messagesWithReactions.length === 4, 'Should have 4 original messages')

  // Check reactions are attached to correct messages
  const firstMessage = messagesWithReactions[0] // Reverse chronological
  const secondMessage = messagesWithReactions[1]
  const thirdMessage = messagesWithReactions[2]

  assert(
    firstMessage.childMessages?.length === 1,
    'First message should have 1 reaction'
  )
  let messageType = firstMessage.childMessages![0].contentTypeId
  assert(
    messageType === 'xmtp.org/reaction:2.0',
    'First message should have reaction V2 type, but got ' + messageType
  )
  let messageContent: ReactionContent =
    firstMessage.childMessages![0].content() as ReactionContent
  assert(
    messageContent.content === '👍',
    'First message should have thumbs up, but got ' + messageContent.content
  )

  assert(
    secondMessage.childMessages?.length === 1,
    'Second message should have 1 reaction'
  )
  messageType = secondMessage.childMessages![0].contentTypeId
  assert(
    messageType === 'xmtp.org/reaction:2.0',
    'Second message should have reaction V2 type, but got ' + messageType
  )
  messageContent = secondMessage.childMessages![0].content() as ReactionContent
  assert(
    messageContent.content === '❤️',
    'Second message should have heart, but got ' + messageContent.content
  )
  assert(
    messageContent.reference === messages![1].id,
    'Second message should have reference to second message, but got ' +
      messageContent.reference
  )
  assert(
    messageContent.action === 'added',
    'Second message should have added action, but got ' + messageContent.action
  )
  assert(
    messageContent.schema === 'unicode',
    'Second message should have unicode schema, but got ' +
      messageContent.schema
  )

  assert(
    !thirdMessage.childMessages?.length,
    'Third message should have no reactions'
  )

  return true
})

test('remote attachments should work', async () => {
  const [alix, bo] = await createClients(2)
  const convo = await alix.conversations.newConversation(bo.address)

  // Alice is sending Bob a file from her phone.
  const filename = `${Date.now()}.txt`
  const file = `${fs.dirs.CacheDir}/${filename}`
  await fs.writeFile(file, 'hello world', 'utf8')
  const { encryptedLocalFileUri, metadata } = await alix.encryptAttachment({
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
  const attached = await alix.decryptAttachment({
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
