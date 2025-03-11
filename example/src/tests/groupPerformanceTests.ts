/* eslint-disable @typescript-eslint/no-extra-non-null-assertion */
import { Wallet } from 'ethers'
import RNFS from 'react-native-fs'
import {
  Client,
  GroupUpdatedCodec,
  ReactionCodec,
  RemoteAttachmentCodec,
  ReplyCodec,
  StaticAttachmentCodec,
} from 'xmtp-react-native-sdk'

import {
  Test,
  assert,
  createClients,
  adaptEthersWalletToSigner,
} from './test-utils'

export const groupPerformanceTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  groupPerformanceTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('building and creating', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const dbDirPath = `${RNFS.DocumentDirectoryPath}/xmtp_db`
  const directoryExists = await RNFS.exists(dbDirPath)
  if (!directoryExists) {
    await RNFS.mkdir(dbDirPath)
  }
  const alixWallet = Wallet.createRandom()

  const start1 = performance.now()
  const alix = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'dev',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath,
    codecs: [
      new ReactionCodec(),
      new ReplyCodec(),
      new GroupUpdatedCodec(),
      new StaticAttachmentCodec(),
      new RemoteAttachmentCodec(),
    ],
  })
  const end1 = performance.now()
  console.log(`Created a new client in ${end1 - start1}ms`)

  const start2 = performance.now()
  await Client.build(alix.publicIdentity, {
    env: 'dev',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath,
    codecs: [
      new ReactionCodec(),
      new ReplyCodec(),
      new GroupUpdatedCodec(),
      new StaticAttachmentCodec(),
      new RemoteAttachmentCodec(),
    ],
  })
  const end2 = performance.now()
  console.log(`Built a client in ${end2 - start2}ms`)

  const start3 = performance.now()
  await Client.build(
    alix.publicIdentity,
    {
      env: 'dev',
      dbEncryptionKey: keyBytes,
      dbDirectory: dbDirPath,
      codecs: [
        new ReactionCodec(),
        new ReplyCodec(),
        new GroupUpdatedCodec(),
        new StaticAttachmentCodec(),
        new RemoteAttachmentCodec(),
      ],
    },
    alix.inboxId
  )
  const end3 = performance.now()
  console.log(`Built a client with inboxId in ${end3 - start3}ms`)

  assert(
    end2 - start2 < end1 - start1,
    'building a client should be faster than creating one'
  )
  assert(
    end3 - start3 < end1 - start1,
    'building a client with an inboxId should be faster than creating one'
  )
  assert(
    end3 - start3 < end2 - start2,
    'building a client with an inboxId should be faster than building without'
  )

  return true
})

test('creating a new conversation', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3, 'dev')

  const start1 = performance.now()
  await alixClient.conversations.newConversation(boClient.inboxId)
  const end1 = performance.now()
  console.log(`Alix created a dm with Bo in ${end1 - start1}ms`)

  await boClient.conversations.syncAllConversations()
  const start2 = performance.now()
  await boClient.conversations.newConversation(alixClient.inboxId)
  const end2 = performance.now()
  console.log(`Bo found a dm with Alix in ${end2 - start2}ms`)

  const start3 = performance.now()
  await alixClient.conversations.newGroup([
    boClient.inboxId,
    caroClient.inboxId,
  ])
  const end3 = performance.now()
  console.log(`Alix created a group with Bo and Caro in ${end3 - start3}ms`)

  const start4 = performance.now()
  await alixClient.conversations.newGroup(
    [boClient.inboxId, caroClient.inboxId],
    {
      permissionLevel: 'admin_only',
      name: 'Group Name',
      imageUrl: 'imageurl.com',
      description: 'group description',
    }
  )
  const end4 = performance.now()
  console.log(
    `Alix created a group with Bo and Caro with metadata in ${end4 - start4}ms`
  )
  assert(
    end1 - start1 < 1000,
    `Creating a new dm should be less than a second but was ${end1 - start1}`
  )
  assert(
    end2 - start2 < 1000,
    `Finding a existing dm should be less than a second but was ${end2 - start2}`
  )
  assert(
    end3 - start3 < 1000,
    `Creating a new group without metadata should be less than a second but was ${end3 - start3}`
  )
  assert(
    end4 - start4 < 1000,
    `Creating a new group with metadata should be less than a second but was ${end4 - start4}`
  )
  return true
})

test('sending messages in conversations', async () => {
  const [alixClient, boClient, caroClient] = await createClients(10, 'local')
  const alixDm = await alixClient.conversations.newConversation(
    boClient.inboxId
  )
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.inboxId,
    caroClient.inboxId,
  ])
  await boClient.conversations.syncAllConversations()
  await caroClient.conversations.syncAllConversations()
  const boDm = await alixClient.conversations.findConversation(alixDm.id)
  const boGroup = await alixClient.conversations.findGroup(alixGroup.id)
  const caroGroup = await alixClient.conversations.findConversation(
    alixGroup.id
  )

  const start1 = performance.now()
  await boDm?.send('message 1')
  const end1 = performance.now()
  console.log(`Bo sent message to dm in ${end1 - start1}ms`)

  const start2 = performance.now()
  await alixDm.send('message 2')
  const end2 = performance.now()
  console.log(`Alix sent message to dm in ${end2 - start2}ms`)

  const start3 = performance.now()
  await alixGroup.send('message 1')
  const end3 = performance.now()
  console.log(`Alix sent message to group in ${end3 - start3}ms`)

  const start4 = performance.now()
  await caroGroup?.send('message 2')
  const end4 = performance.now()
  console.log(`Caro sent message to group in ${end4 - start4}ms`)
  const start5 = performance.now()
  await boGroup?.send('message 3')
  const end5 = performance.now()
  console.log(`Bo sent message to group in ${end5 - start5}ms`)
  assert(
    end1 - start1 < 500,
    `Sending message to dm should take less than .5s but was ${end1 - start1}`
  )
  assert(
    end2 - start2 < 500,
    `Sending message to dm should take less than .5s but was ${end2 - start2}`
  )
  assert(
    end3 - start3 < 500,
    `Sending message to group should take less than .5s but was ${end3 - start3}`
  )
  assert(
    end4 - start4 < 500,
    `Sending message to grop should take less than .5s but was ${end4 - start4}`
  )
  assert(
    end5 - start5 < 500,
    `Sending message to grop should take less than .5s but was ${end5 - start5}`
  )
  return true
})
