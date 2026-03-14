import { Wallet } from 'ethers'
import RNFS from 'react-native-fs'
import { PreferenceUpdates } from 'xmtp-react-native-sdk/lib/PrivatePreferences'

import {
  Test,
  assert,
  createClients,
  delayToPropogate,
  adaptEthersWalletToSigner,
} from './test-utils'
import { Client, ConsentRecord } from '../../../src/index'

export const historySyncTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  historySyncTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('can sync consent', async () => {
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
  })

  // Create DM conversation
  const dm = await alix.conversations.findOrCreateDm(bo.inboxId)
  const initialConsent = await dm.consentState()
  assert(
    initialConsent === 'unknown' || initialConsent === 'allowed',
    `Expected initial consent unknown or allowed, got ${initialConsent}`
  )

  await bo.conversations.sync()

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath2,
  })

  const state = await alix2.inboxState(true)
  assert(
    state.installations.length === 2,
    `Expected 2 installations, got ${state.installations.length}`
  )

  // Sync the DM on alix so conversation is pushed
  await dm.sync()
  await delayToPropogate(1000)
  await alix.conversations.syncAllConversations()
  await delayToPropogate(1000)

  // Alix2 syncs so it has the DM (mirrors Android alixClient2.conversations.sync())
  await alix2.conversations.sync()
  await delayToPropogate(1000)

  const dm2Initial = await alix2.conversations.findConversation(dm.id)
  if (!dm2Initial) {
    throw new Error(
      `Failed to find DM with ID: ${dm.id} on alix2 before consent update`
    )
  }
  const consentOnAlix2Before = await dm2Initial.consentState()
  assert(
    consentOnAlix2Before === 'unknown' || consentOnAlix2Before === 'allowed',
    `Expected alix2 consent unknown/allowed before update, got ${consentOnAlix2Before}`
  )

  // Now update consent to denied on alix (same order as Android: after both have the convo)
  await dm.updateConsent('denied')
  const consentState = await dm.consentState()
  assert(consentState === 'denied', `Expected 'denied', got ${consentState}`)

  await alix.preferences.sync()
  await delayToPropogate(1000)
  await alix2.preferences.sync()
  // Longer delay before asserting consent propagation (Android uses delay(4000))
  await delayToPropogate(4000)

  const dm2 = await alix2.conversations.findConversation(dm.id)
  if (!dm2) {
    throw new Error(`Failed to find DM with ID: ${dm.id} on alix2`)
  }
  const consentState2 = await dm2.consentState()
  assert(consentState2 === 'denied', `Expected 'denied', got ${consentState2}`)

  await alix2.preferences.setConsentState(
    new ConsentRecord(dm2.id, 'conversation_id', 'allowed')
  )

  const convoState = await alix2.preferences.conversationConsentState(dm2.id)
  assert(convoState === 'allowed', `Expected 'allowed', got ${convoState}`)

  const updatedConsentState = await dm2.consentState()
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
  })

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath2,
  })

  const alixGroup = await alix.conversations.newGroup([bo.inboxId])

  await alix.conversations.syncAllConversations()
  await delayToPropogate(2000)
  await alix2.conversations.syncAllConversations()
  await delayToPropogate(2000)

  const alix2Group = await alix2.conversations.findGroup(alixGroup.id)
  if (!alix2Group) {
    throw new Error(`Failed to find group with ID: ${alixGroup.id} on alix2`)
  }

  const consent: ConsentRecord[] = []
  await alix.preferences.streamConsent(async (entry: ConsentRecord) => {
    consent.push(entry)
  })
  await alix.conversations.streamAllMessages(async () => {
    // Keep stream active (mirrors Android job1)
  })

  await delayToPropogate(2000)

  await alix2Group.updateConsent('denied')
  await alix2.preferences.sync()
  await delayToPropogate(2000)

  await delayToPropogate(2000)

  assert(
    consent.length === 1,
    `Expected 1 consent record on stream, got ${consent.length}`
  )
  const updatedConsentState = await alixGroup.consentState()
  assert(
    updatedConsentState === 'denied',
    `Expected 'denied', got ${updatedConsentState}`
  )

  alix.preferences.cancelStreamConsent()
  alix.conversations.cancelStreamAllMessages()

  return true
})

test('can stream preference updates', async () => {
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
  })

  await alix2.conversations.syncAllConversations()
  await delayToPropogate(2000)
  await alix.conversations.syncAllConversations()
  await delayToPropogate(2000)

  assert(
    types.length === 1,
    `Expected 1 preference update, got ${types.length}`
  )

  alix.preferences.cancelStreamConsent()

  return true
})

test('can sync device archive (sendSyncArchive, listAvailableArchives, processSyncArchive)', async () => {
  const [bo] = await createClients(1)
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const dbDirPath = `${RNFS.DocumentDirectoryPath}/xmtp_db_sync_archive_1`
  const dbDirPath2 = `${RNFS.DocumentDirectoryPath}/xmtp_db_sync_archive_2`

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
  })

  const group = await alix.conversations.newGroup([bo.inboxId])
  const msgFromAlix = await group.send('hello from alix')

  await delayToPropogate(1000)

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath2,
  })

  await delayToPropogate(1000)

  await alix.syncAllDeviceSyncGroups()
  await alix.sendSyncArchive('123')
  await delayToPropogate(1000)

  await bo.conversations.syncAllConversations()
  const boGroup = await bo.conversations.findGroup(group.id)
  if (!boGroup) throw new Error(`Failed to find group with ID: ${group.id}`)
  await boGroup.send('hello from bo')

  await alix.conversations.syncAllConversations()
  await alix2.conversations.syncAllConversations()

  const group2Before = await alix2.conversations.findGroup(group.id)
  if (!group2Before)
    throw new Error(`Failed to find group with ID: ${group.id}`)
  const messagesBefore = await group2Before.messages()
  assert(
    messagesBefore.length === 2,
    `Expected 2 messages before processSyncArchive, got ${messagesBefore.length}`
  )

  await delayToPropogate(1000)
  await alix.syncAllDeviceSyncGroups()
  await delayToPropogate(1000)
  await alix2.syncAllDeviceSyncGroups()

  // Mirrors Swift/Kotlin test flow: archive listing is observed but not asserted
  await alix2.listAvailableArchives(7)

  await alix2.processSyncArchive('123')
  await alix2.conversations.syncAllConversations()

  const group2After = await alix2.conversations.findGroup(group.id)
  if (!group2After) throw new Error(`Failed to find group with ID: ${group.id}`)
  const messagesAfter = await group2After.messages()
  assert(
    messagesAfter.length === 3,
    `Expected 3 messages after processSyncArchive, got ${messagesAfter.length}`
  )
  assert(
    messagesAfter.some((m) => m.id === msgFromAlix),
    `Expected to find message with id ${msgFromAlix} in messages after sync`
  )

  return true
})

test('can sync messages across installations (sendSyncRequest, syncAllDeviceSyncGroups)', async () => {
  const [bo] = await createClients(1)
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const dbDirPath = `${RNFS.DocumentDirectoryPath}/xmtp_db_sync_messages_1`
  const dbDirPath2 = `${RNFS.DocumentDirectoryPath}/xmtp_db_sync_messages_2`

  if (!(await RNFS.exists(dbDirPath))) {
    await RNFS.mkdir(dbDirPath)
  }
  if (!(await RNFS.exists(dbDirPath2))) {
    await RNFS.mkdir(dbDirPath2)
  }

  const alixWallet = Wallet.createRandom()

  const client1 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath,
  })

  const group = await client1.conversations.newGroup([bo.inboxId])

  // Send a message before second installation is created
  const msgId = await group.send('hi')
  const messageCount = (await group.messages()).length
  assert(
    messageCount === 2,
    `Expected 2 messages (group + hi), got ${messageCount}`
  )

  const client2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath2,
  })

  const state = await client2.inboxState(true)
  assert(
    state.installations.length === 2,
    `Expected 2 installations, got ${state.installations.length}`
  )

  await client2.sendSyncRequest()

  await client1.syncAllDeviceSyncGroups()
  await delayToPropogate(1000)
  await client2.syncAllDeviceSyncGroups()
  await delayToPropogate(1000)

  const client1MessageCount = (await group.messages()).length
  const group2 = await client2.conversations.findGroup(group.id)
  if (!group2) throw new Error(`Failed to find group with ID: ${group.id}`)

  const messages = await group2.messages()
  const containsMessage = messages.some((m) => m.id === msgId)
  const client2MessageCount = messages.length

  assert(
    containsMessage,
    `Expected to find message with id ${msgId} in client2 messages`
  )
  assert(
    client1MessageCount === client2MessageCount,
    `Expected client1 and client2 message counts to match: client1=${client1MessageCount}, client2=${client2MessageCount}`
  )

  return true
})
