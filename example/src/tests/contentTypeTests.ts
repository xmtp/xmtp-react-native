import ReactNativeBlobUtil from 'react-native-blob-util'

import { Test, createClients, delayToPropogate } from './test-utils'
import { RemoteAttachmentContent } from '../../../src/index'
const { fs } = ReactNativeBlobUtil

export const contentTypeTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  contentTypeTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

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
