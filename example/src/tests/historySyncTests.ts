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

test('can sync consent (expected to fail unless historySyncUrl is set)', async () => {
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
    historySyncUrl: 'http://10.0.2.2:5558',
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
    historySyncUrl: 'http://10.0.2.2:5558',
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
    historySyncUrl: 'http://10.0.2.2:5558',
  })

  const alixGroup = await alix.conversations.newGroup([bo.inboxId])

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath2,
    historySyncUrl: 'http://10.0.2.2:5558',
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
    historySyncUrl: 'http://10.0.2.2:5558',
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
    historySyncUrl: 'http://10.0.2.2:5558',
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
