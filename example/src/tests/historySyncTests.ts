import { Wallet } from 'ethers'
import { PreferenceUpdates } from 'xmtp-react-native-sdk/lib/PrivatePreferences'

import {
  Test,
  assert,
  createClients,
  delayToPropogate,
  adaptEthersWalletToSigner,
} from './test-utils'
import { Client, ConsentRecord } from '../../../src/index'
import {
  ensureDirectory,
  joinDocumentPath,
  pathExists,
} from './fileSystemHelpers'

export const historySyncTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  historySyncTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('can sync consent (expected to fail unless historySyncUrl is set)', async () => {
  const [bo] = await createClients(1)
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dbDirPath = joinDocumentPath('xmtp_db')
  const dbDirPath2 = joinDocumentPath('xmtp_db2')
  if (!(await pathExists(dbDirPath))) {
    await ensureDirectory(dbDirPath)
  }
  if (!(await pathExists(dbDirPath2))) {
    await ensureDirectory(dbDirPath2)
  }
  const alixWallet = Wallet.createRandom()

  const alix = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath,
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
  })

  const state = await alix2.inboxState(true)
  assert(
    state.installations.length === 2,
    `Expected 2 installations, got ${state.installations.length}`
  )

  // Sync conversations
  await bo.conversations.sync()
  if (boDm) await boDm.sync()
  await alix2.preferences.sync()
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
  const dbDirPath = joinDocumentPath('xmtp_db')
  const dbDirPath2 = joinDocumentPath('xmtp_db2')

  // Ensure the directories exist
  if (!(await pathExists(dbDirPath))) {
    await ensureDirectory(dbDirPath)
  }
  if (!(await pathExists(dbDirPath2))) {
    await ensureDirectory(dbDirPath2)
  }

  const alixWallet = Wallet.createRandom()

  const alix = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath,
  })

  const alixGroup = await alix.conversations.newGroup([bo.inboxId])

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath2,
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
  const dbDirPath = joinDocumentPath('xmtp_db')
  const dbDirPath2 = joinDocumentPath('xmtp_db2')

  // Ensure the directories exist
  if (!(await pathExists(dbDirPath))) {
    await ensureDirectory(dbDirPath)
  }
  if (!(await pathExists(dbDirPath2))) {
    await ensureDirectory(dbDirPath2)
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
    types.length === 2,
    `Expected 2 preference update, got ${types.length}`
  )

  alix.preferences.cancelStreamConsent()

  return true
})
