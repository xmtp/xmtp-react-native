import ReactNativeBlobUtil from 'react-native-blob-util'

import { Test, assert, createClients, delayToPropogate } from './test-utils'
import {
  DecodedMessage,
  MultiRemoteAttachmentCodec,
  MultiRemoteAttachmentContent,
  ReactionContent,
  RemoteAttachmentContent,
  RemoteAttachmentInfo,
} from '../../../src/index'
const { fs } = ReactNativeBlobUtil

export const contentTypeTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  contentTypeTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('DecodedMessage.from() should throw informative error on null', async () => {
  try {
    DecodedMessage.from("undefined")
  } catch (e: any) {
    assert(e.toString().includes('JSON Parse error'), 'Error: ' + e.toString())
  }

  try {
    DecodedMessage.from("")
  } catch (e: any) {
    assert(e.toString().includes('JSON Parse error'), 'Error: ' + e.toString())
  }

  try {
    DecodedMessage.from(undefined)
  } catch (e: any) {
    assert(e.toString().includes('JSON Parse error'), 'Error: ' + e.toString())
  }

  try {
    DecodedMessage.from(null)
  } catch (e: any) {
    assert(e.toString().includes('Tried to parse null as a DecodedMessage'), 'Error: ' + e.toString())
  }

  try {
    DecodedMessage.from("null")
  } catch (e: any) {
    assert(e.toString().includes('Tried to parse null as a DecodedMessage'), 'Error: ' + e.toString())
  }

  let json = '{"id": "123", "topic": "123", "contentTypeId": "123", "senderInboxId": "123", "sentNs": 123, "content": "123", "fallback": "123", "deliveryStatus": "123", "childMessages": null}'
  try {
    DecodedMessage.from(json)
  } catch (e: any) {
    assert(false, 'Error: ' + e.toString())
  }
  return true

})

test('can fetch messages with reactions', async () => {
  const [alix, bo] = await createClients(2)

  // Create group and sync
  const group = await alix.conversations.newGroup([bo.inboxId])
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
  assert(messages?.length === 4, 'Should have 4 messages')

  assert(
    messages![0].contentTypeId === 'xmtp.org/text:1.0',
    'First message should be a text message'
  )
  assert(
    messages![1].contentTypeId === 'xmtp.org/text:1.0',
    'Second message should be a text message'
  )
  assert(
    messages![2].contentTypeId === 'xmtp.org/text:1.0',
    'Third message should be a text message'
  )
  assert(
    messages![3].contentTypeId === 'xmtp.org/group_updated:1.0',
    'Fourth message should be a group updated'
  )

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
  const group = await alix.conversations.newGroup([bo.inboxId])
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
  assert(messages?.length === 4, 'Should have 4 messages')
  assert(
    messages![0].contentTypeId === 'xmtp.org/text:1.0',
    'First message should be a text message'
  )
  assert(
    messages![1].contentTypeId === 'xmtp.org/text:1.0',
    'Second message should be a text message'
  )
  assert(
    messages![2].contentTypeId === 'xmtp.org/text:1.0',
    'Third message should be a text message'
  )
  assert(
    messages![3].contentTypeId === 'xmtp.org/group_updated:1.0',
    'Fourth message should be a group updated'
  )

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
  const convo = await alix.conversations.newConversation(bo.inboxId)

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
  if (messages.length !== 2) {
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

const attachmentUrlMap: Map<string, string> = new Map()

function testUploadAttachmentForUrl(uriLocalEncryptedData: string): string {
  const url = 'https://' + Math.random().toString(36).substring(2, 15) + '.com'
  attachmentUrlMap.set(url, uriLocalEncryptedData)
  return url
}

function testDownloadFromUrlForLocalUri(url: string): string {
  const attachmentUriAfterDownload = attachmentUrlMap.get(url)
  if (!attachmentUriAfterDownload) {
    throw new Error('Expected attachment to exist')
  }
  return attachmentUriAfterDownload
}

type fileInfo = {
  filename: string
  fileUri: string
}

test('multi remote attachments should work', async () => {
  const [alix, bo] = await createClients(2)
  const convo = await alix.conversations.newConversation(bo.inboxId)

  // Alice is sending Bob two files from her phone.
  const filename1 = `${Date.now()}.txt`
  const file1 = `${fs.dirs.CacheDir}/${filename1}`
  await fs.writeFile(file1, 'hello world 1', 'utf8')
  const fileInfo1: fileInfo = {
    filename: filename1,
    fileUri: `file://${file1}`,
  }

  const filename2 = `${Date.now()}.txt`
  const file2 = `${fs.dirs.CacheDir}/${filename2}`
  await fs.writeFile(file2, 'hello world 2', 'utf8')
  const fileInfo2: fileInfo = {
    filename: filename2,
    fileUri: `file://${file2}`,
  }

  const remoteAttachments: RemoteAttachmentInfo[] = []
  for (const fileInfo of [fileInfo1, fileInfo2]) {
    const { encryptedLocalFileUri, metadata } = await alix.encryptAttachment({
      fileUri: fileInfo.fileUri,
      mimeType: 'text/plain',
      filename: fileInfo.filename,
    })
    console.log('encryptedLocalFileUri saved to: ', encryptedLocalFileUri)

    const url = testUploadAttachmentForUrl(encryptedLocalFileUri)
    const remoteAttachmentInfo =
      MultiRemoteAttachmentCodec.buildMultiRemoteAttachmentInfo(url, metadata)
    remoteAttachments.push(remoteAttachmentInfo)
  }

  await convo.send({
    multiRemoteAttachment: {
      attachments: remoteAttachments,
    },
  })

  await delayToPropogate()

  // Now we should see the remote attachment message.
  const messages = await convo.messages()
  if (messages.length !== 2) {
    throw new Error('Expected 2 message')
  }
  const message = messages[0]

  if (message.contentTypeId !== 'xmtp.org/multiRemoteStaticAttachment:1.0') {
    throw new Error('Expected correctly formatted typeId')
  }
  if (!message.content()) {
    throw new Error('Expected multiRemoteAttachment')
  }

  const multiRemoteAttachment =
    message.content() as MultiRemoteAttachmentContent
  if (multiRemoteAttachment.attachments.length !== 2) {
    throw new Error('Expected 2 attachments')
  }

  assert(
    multiRemoteAttachment.attachments[0].url === remoteAttachments[0].url,
    'Expected url to match'
  )
  assert(
    multiRemoteAttachment.attachments[1].url === remoteAttachments[1].url,
    'Expected url to match'
  )

  // Show how when we can convert a multiRemoteAttachment back into decrypted encoded content

  const files: string[] = []
  for (const attachment of multiRemoteAttachment.attachments) {
    // Simulate downloading the encrypted payload from the URL and saving it locally
    const attachmentUriAfterDownload: string = testDownloadFromUrlForLocalUri(
      attachment.url
    )
    // Decrypt the local file
    const decryptedLocalAttachment = await alix.decryptAttachment({
      encryptedLocalFileUri: attachmentUriAfterDownload,
      metadata: {
        secret: attachment.secret,
        salt: attachment.salt,
        nonce: attachment.nonce,
        contentDigest: attachment.contentDigest,
        filename: attachment.filename,
      } as RemoteAttachmentContent,
    })
    assert(
      decryptedLocalAttachment.fileUri.startsWith('file:/'),
      'Expected fileUri to start with file:// but it is ' +
        decryptedLocalAttachment.fileUri
    )
    // Read the decrypted file
    const text = await fs.readFile(
      new URL(decryptedLocalAttachment.fileUri).pathname,
      'utf8'
    )
    files.push(text)
  }

  assert(files[0] === 'hello world 1', 'Expected text to match')
  assert(files[1] === 'hello world 2', 'Expected text to match')

  return true
})
