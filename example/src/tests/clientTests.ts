import { ethers, Wallet } from 'ethers'
import RNFS from 'react-native-fs'
import {
  ArchiveMetadata,
  ArchiveOptions,
} from 'xmtp-react-native-sdk/lib/ArchiveOptions'
import { InstallationId } from 'xmtp-react-native-sdk/lib/Client'

import {
  Test,
  assert,
  createClients,
  adaptEthersWalletToSigner,
  assertEqual,
  delayToPropogate,
} from './test-utils'
import { Client, PublicIdentity } from '../../../src/index'
import { LogLevel, LogRotation } from '../../../src/lib/types/LogTypes'

export const clientTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  clientTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('can be built offline', async () => {
  const [alix] = await createClients(2)
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  await alix.debugInformation.clearAllStatistics()
  console.log(
    'Initial Stats',
    (await alix.debugInformation.getNetworkDebugInformation())
      .aggregateStatistics
  )

  const builtClient = await Client.build(
    alix.publicIdentity,
    {
      env: 'local',
      dbEncryptionKey: keyBytes,
    },
    alix.inboxId
  )

  console.log(
    'Post Build Stats',
    (await builtClient.debugInformation.getNetworkDebugInformation())
      .aggregateStatistics
  )
  assert(builtClient.inboxId === alix.inboxId, 'inboxIds should match')

  return true
})

test('can manage revoke manually statically', async () => {
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
  const alixSigner = adaptEthersWalletToSigner(alixWallet)

  // create a v3 client
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

  const inboxId = alix.inboxId
  const states = await Client.inboxStatesForInboxIds('local', [inboxId])

  assert(states[0].installations.length === 2, 'should equal 5 installations')

  const toRevokeIds = states[0].installations.map((i) => i.id)

  const sigText = await Client.ffiRevokeInstallationsSignatureText(
    'local',
    alix.publicIdentity,
    inboxId,
    toRevokeIds as InstallationId[]
  )
  const signedMessage = await alixSigner.signMessage(sigText)

  const { r, s, v } = ethers.utils.splitSignature(signedMessage.signature)
  const signature = ethers.utils.arrayify(
    ethers.utils.joinSignature({ r, s, v })
  )

  await Client.ffiAddEcdsaSignature('revokeInstallations', signature)
  await Client.ffiApplySignatureRequest('local', 'revokeInstallations')
  const postRevokeStates = await Client.inboxStatesForInboxIds('local', [
    inboxId,
  ])

  assert(postRevokeStates.length === 1, 'should return 1 state after revoke')
  assert(
    postRevokeStates[0].installations.length === 0,
    'installations should be empty after revoke'
  )

  await alix.dropLocalDatabaseConnection()
  await alix.deleteLocalDatabase()
  await alix2.dropLocalDatabaseConnection()
  await alix2.deleteLocalDatabase()

  return true
})

test('static revoke all installations', async () => {
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

  // create a v3 client
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

  const inboxId = alix.inboxId
  const states = await Client.inboxStatesForInboxIds('local', [inboxId])

  assert(states[0].installations.length === 2, 'should equal 2 installations')

  const toRevokeIds = states[0].installations.map((i) => i.id)

  await Client.revokeInstallations(
    'local',
    adaptEthersWalletToSigner(alixWallet),
    inboxId,
    toRevokeIds as InstallationId[]
  )

  const postRevokeStates = await Client.inboxStatesForInboxIds('local', [
    inboxId,
  ])

  assert(postRevokeStates.length === 1, 'should return 1 state after revoke')
  assert(
    postRevokeStates[0].installations.length === 0,
    'installations should be empty after revoke'
  )

  await alix.dropLocalDatabaseConnection()
  await alix.deleteLocalDatabase()
  await alix2.dropLocalDatabaseConnection()
  await alix2.deleteLocalDatabase()

  return true
})

test('cannot create more than 10 installations', async () => {
  const [boClient] = await createClients(1)
  const keyBytes = new Uint8Array(32).fill(2)
  const wallet = Wallet.createRandom()
  const basePath = `${RNFS.DocumentDirectoryPath}/xmtp_limit_test`
  const paths: string[] = []

  for (let i = 0; i < 11; i++) {
    const p = `${basePath}_${i}`
    paths.push(p)
    if (!(await RNFS.exists(p))) await RNFS.mkdir(p)
  }

  const clients = []
  for (let i = 0; i < 10; i++) {
    clients.push(
      await Client.create(adaptEthersWalletToSigner(wallet), {
        env: 'local',
        dbEncryptionKey: keyBytes,
        dbDirectory: paths[i],
      })
    )
  }

  const state = await clients[0].inboxState(true)
  assert(state.installations.length === 10, 'should equal 10')

  // 6th installation should fail
  let failed = false
  try {
    await Client.create(adaptEthersWalletToSigner(wallet), {
      env: 'local',
      dbEncryptionKey: keyBytes,
      dbDirectory: paths[10],
    })
  } catch (err: any) {
    failed = true
    assert(
      err.message.includes('10/10 installations'),
      `Unexpected error message: ${err.message}`
    )
  }
  assert(failed, 'Expected error when creating 6th installation')

  // Revoke one installation
  await clients[0].revokeInstallations(adaptEthersWalletToSigner(wallet), [
    clients[9].installationId,
  ])

  const updatedState = await clients[0].inboxState(true)
  assert(updatedState.installations.length === 9, 'should equal 9')

  const sixthNow = await Client.create(adaptEthersWalletToSigner(wallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: `${basePath}_11`,
  })

  const finalState = await clients[0].inboxState(true)
  assert(finalState.installations.length === 10, 'should equal 10')

  for (const client of [...clients, boClient, sixthNow]) {
    await client.dropLocalDatabaseConnection()
    await client.deleteLocalDatabase()
  }

  await new Promise((resolve) => setTimeout(resolve, 1000))
  return true
})

test('can get installation keypackage statuses', async () => {
  const [alix, bo] = await createClients(2)

  const statuses = await alix.debugInformation.getKeyPackageStatuses([
    alix.installationId,
    bo.installationId,
  ])

  assert(statuses.statuses.has(alix.installationId), 'Alix status missing')
  assert(statuses.statuses.has(bo.installationId), 'Bo status missing')

  const alixStatus = statuses.statuses.get(alix.installationId)
  assert(alixStatus?.validationError === '', 'Alix has a validation error')
  assert(
    alixStatus!.lifetime.notBefore < alixStatus!.lifetime.notAfter,
    'Alix key package lifetime is invalid'
  )

  return true
})

test('can make a client', async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const client = await Client.createRandom({
    env: 'local',
    dbEncryptionKey: keyBytes,
    deviceSyncEnabled: false,
    appVersion: '0.0.0',
  })

  const inboxId = await Client.getOrCreateInboxId(
    client.publicIdentity,
    'local'
  )

  assert(
    client.inboxId === inboxId,
    `inboxIds should match but were ${client.inboxId} and ${inboxId}`
  )
  return true
})

test('static can message', async () => {
  const [alix, bo] = await createClients(2)

  const addressMap = await Client.canMessage('local', [
    alix.publicIdentity,
    new PublicIdentity(
      '0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67',
      'ETHEREUM'
    ),
    bo.publicIdentity,
  ])

  assert(
    addressMap[
      '0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67'.toLocaleLowerCase()
    ] === false,
    `should not be able to message 0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67`
  )

  assert(
    addressMap[alix.publicIdentity.identifier] === true,
    `should be able to message ${alix.publicIdentity.identifier}`
  )

  assert(
    addressMap[bo.publicIdentity.identifier] === true,
    `should be able to message ${bo.publicIdentity.identifier}`
  )
  return true
})

test('static inboxStates for inboxIds', async () => {
  const [alix, bo] = await createClients(2)

  const inboxStates = await Client.inboxStatesForInboxIds('local', [
    alix.inboxId,
    bo.inboxId,
  ])

  assert(
    inboxStates[0].recoveryIdentity.identifier ===
      alix.publicIdentity.identifier,
    `inbox state should be ${alix.publicIdentity.identifier} but was ${inboxStates[0].recoveryIdentity.identifier}`
  )

  assert(
    inboxStates[1].recoveryIdentity.identifier === bo.publicIdentity.identifier,
    `inbox state should be ${bo.publicIdentity.identifier} but was ${inboxStates[1].recoveryIdentity.identifier}`
  )

  return true
})

test('static can get log files', async () => {
  Client.deactivatePersistentLibXMTPLogWriter()
  Client.clearXMTPLogs()
  const originalLogFilePaths = Client.getXMTPLogFilePaths()
  assert(originalLogFilePaths.length === 0, 'should have log files')
  Client.activatePersistentLibXMTPLogWriter(
    LogLevel.DEBUG,
    LogRotation.MINUTELY,
    10
  )
  const [alix, bo] = await createClients(2)

  const addressMap = await Client.canMessage('local', [
    alix.publicIdentity,
    new PublicIdentity(
      '0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67',
      'ETHEREUM'
    ),
    bo.publicIdentity,
  ])

  assert(
    addressMap[
      '0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67'.toLocaleLowerCase()
    ] === false,
    `should not be able to message 0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67`
  )

  assert(
    addressMap[alix.publicIdentity.identifier] === true,
    `should be able to message ${alix.publicIdentity.identifier}`
  )

  assert(
    addressMap[bo.publicIdentity.identifier] === true,
    `should be able to message ${bo.publicIdentity.identifier}`
  )

  const logFilePaths = Client.getXMTPLogFilePaths()
  assert(logFilePaths.length > 0, 'should have log files')

  // Read the first log file and check its contents
  if (logFilePaths.length > 0) {
    console.log('num log files', logFilePaths.length)
    console.log('logFilePaths', logFilePaths[0])
    Client.deactivatePersistentLibXMTPLogWriter()

    const logContent = await Client.readXMTPLogFile(logFilePaths[0])
    console.log('logContent length:', logContent.length)
    console.log('logContent sample:', logContent.substring(0, 200))
    console.log('logContent', logContent)
    assert(
      logContent.includes(alix.inboxId),
      'Log file should contain the inboxId: ' + alix.inboxId
    )
  }
  Client.deactivatePersistentLibXMTPLogWriter()
  Client.clearXMTPLogs()
  return true
})

test('can revoke all other installations', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const alixWallet = Wallet.createRandom()

  // create a v3 client
  const alix = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
  })

  await alix.dropLocalDatabaseConnection()

  await alix.deleteLocalDatabase()

  await new Promise((resolve) => setTimeout(resolve, 1000))

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
  })

  await alix2.dropLocalDatabaseConnection()

  await alix2.deleteLocalDatabase()

  await new Promise((resolve) => setTimeout(resolve, 1000))

  const alix3 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
  })

  const inboxState2 = await alix3.inboxState(true)
  assert(
    inboxState2.installations.length === 3,
    `installations length should be 3 but was ${inboxState2.installations.length}`
  )

  await alix3.revokeAllOtherInstallations(adaptEthersWalletToSigner(alixWallet))

  const inboxState3 = await alix3.inboxState(true)
  assert(
    inboxState3.installations.length === 1,
    `installations length should be 1 but was ${inboxState3.installations.length}`
  )

  assert(
    inboxState3.installations[0].createdAt !== undefined,
    `installations createdAt should not be undefined`
  )
  return true
})

test('calls preAuthenticateToInboxCallback when supplied', async () => {
  let isCallbackCalled = 0
  let isPreAuthCalled = false
  const preAuthenticateToInboxCallback = () => {
    isCallbackCalled++
    isPreAuthCalled = true
  }

  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  await Client.createRandom({
    env: 'local',
    preAuthenticateToInboxCallback,
    dbEncryptionKey: keyBytes,
  })

  assert(
    isCallbackCalled === 1,
    `callback should be called 1 times but was ${isCallbackCalled}`
  )

  if (!isPreAuthCalled) {
    throw new Error('preAuthenticateToInboxCallback not called')
  }

  return true
})

test('can delete a local database', async () => {
  let [client, anotherClient] = await createClients(2)

  await client.conversations.newGroup([anotherClient.inboxId])
  await client.conversations.sync()
  assert(
    (await client.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await client.conversations.listGroups()).length
    }`
  )

  assert(
    client.dbPath !== '',
    `client dbPath should be set but was ${client.dbPath}`
  )
  await client.dropLocalDatabaseConnection()
  await client.deleteLocalDatabase()
  await new Promise((resolve) => setTimeout(resolve, 1000))

  client = await Client.createRandom({
    env: 'local',
    dbEncryptionKey: new Uint8Array([
      233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
      166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135,
      145,
    ]),
  })
  await client.conversations.sync()
  assert(
    (await client.conversations.listGroups()).length === 0,
    `should have a group size of 0 but was ${
      (await client.conversations.listGroups()).length
    }`
  )

  return true
})

test('can make a client with encryption key and database directory', async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dbDirPath = `${RNFS.DocumentDirectoryPath}/xmtp_db`
  const directoryExists = await RNFS.exists(dbDirPath)
  if (!directoryExists) {
    await RNFS.mkdir(dbDirPath)
  }
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  const client = await Client.createRandom({
    env: 'local',
    dbEncryptionKey: key,
    dbDirectory: dbDirPath,
  })

  const anotherClient = await Client.createRandom({
    env: 'local',
    dbEncryptionKey: key,
  })

  await client.conversations.newGroup([anotherClient.inboxId])
  assert(
    (await client.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await client.conversations.listGroups()).length
    }`
  )

  const clientFromBundle = await Client.build(client.publicIdentity, {
    env: 'local',
    dbEncryptionKey: key,
    dbDirectory: dbDirPath,
  })

  assert(
    clientFromBundle.inboxId === client.inboxId,
    `clients dont match ${client.inboxId} and ${clientFromBundle.inboxId}`
  )

  assert(
    (await clientFromBundle.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await clientFromBundle.conversations.listGroups()).length
    }`
  )
  return true
})

test('can get a inboxId from an address', async () => {
  const [alix, bo] = await createClients(2)

  const boInboxId = await alix.findInboxIdFromIdentity(bo.publicIdentity)
  assert(boInboxId === bo.inboxId, `${boInboxId} should match ${bo.inboxId}`)
  return true
})

test('production client creation does not error', async () => {
  const key = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  try {
    await Client.createRandom({
      env: 'production',
      dbEncryptionKey: key,
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    throw error
  }
  return true
})

test('can find others inbox states', async () => {
  const [alix, bo, caro] = await createClients(3)

  const states = await alix.inboxStates(true, [bo.inboxId, caro.inboxId])
  assert(
    states[0].recoveryIdentity.identifier.toLowerCase ===
      bo.publicIdentity.identifier.toLowerCase,
    `identities dont match ${states[0].recoveryIdentity} and ${bo.publicIdentity.identifier}`
  )
  assert(
    states[1].identities[0].identifier.toLowerCase ===
      caro.publicIdentity.identifier.toLowerCase,
    `clients dont match ${states[1].identities[0]} and ${caro.publicIdentity.identifier}`
  )

  return true
})

test('can verify signatures', async () => {
  const [alix, bo] = await createClients(2)
  const signature = await alix.signWithInstallationKey('a message')

  assert(
    (await alix.verifySignature('a message', signature)) === true,
    `message should verify`
  )

  assert(
    (await alix.verifySignature('bad string', signature)) === false,
    `message should not verify for bad string`
  )

  assert(
    (await bo.verifySignature('a message', signature)) === false,
    `message should not verify for bo`
  )

  return true
})

test('test add account with existing InboxIds', async () => {
  const [alixClient] = await createClients(1)

  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  const boWallet = Wallet.createRandom()

  const boClient = await Client.create(adaptEthersWalletToSigner(boWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
  })

  let errorThrown = false
  try {
    await alixClient.addAccount(adaptEthersWalletToSigner(boWallet))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    errorThrown = true
  }

  if (!errorThrown) {
    throw new Error('Expected addAccount to throw an error but it did not')
  }

  // Ensure that both clients have different inbox IDs
  assert(
    alixClient.inboxId !== boClient.inboxId,
    'Inbox ids should not be equal'
  )

  // Forcefully add the boClient account to alixClient
  await alixClient.addAccount(adaptEthersWalletToSigner(boWallet), true)

  // Retrieve the inbox state and check the number of associated identities
  const state = await alixClient.inboxState(true)
  await assertEqual(state.identities.length, 2, 'Length should be 2')

  // Validate that the inbox ID from the address matches alixClient's inbox ID
  const inboxId = await alixClient.findInboxIdFromIdentity(
    boClient.publicIdentity
  )
  await assertEqual(inboxId, alixClient.inboxId, 'InboxIds should be equal')

  return true
})

test('can add and remove accounts', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])

  const alixWallet = Wallet.createRandom()
  const alixWallet2 = Wallet.createRandom()
  const alixWallet3 = Wallet.createRandom()

  const alix = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
  })

  await alix.addAccount(adaptEthersWalletToSigner(alixWallet2))
  await alix.addAccount(adaptEthersWalletToSigner(alixWallet3))

  const inboxState = await alix.inboxState(true)
  assert(
    inboxState.identities.length === 3,
    `identities length should be 3 but was ${inboxState.identities.length}`
  )
  assert(
    inboxState.installations.length === 1,
    `identities length should be 1 but was ${inboxState.installations.length}`
  )
  assert(
    inboxState.recoveryIdentity.identifier ===
      alix.publicIdentity.identifier.toLowerCase(),
    `recovery address should be ${alix.publicIdentity.identifier} but was ${inboxState.recoveryIdentity}`
  )

  await alix.removeAccount(
    adaptEthersWalletToSigner(alixWallet),
    new PublicIdentity(await alixWallet3.getAddress(), 'ETHEREUM')
  )
  const inboxState2 = await alix.inboxState(true)
  assert(
    inboxState2.identities.length === 2,
    `identities length should be 2 but was ${inboxState.identities.length}`
  )

  return true
})

test('errors if dbEncryptionKey is lost', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const badKeyBytes = new Uint8Array([
    0, 0, 0, 0, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64, 166, 83,
    208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 0, 0, 0, 0,
  ])
  const alixWallet = Wallet.createRandom()

  const alix = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
  })

  let errorThrown = false

  try {
    await Client.build(alix.publicIdentity, {
      env: 'local',
      dbEncryptionKey: badKeyBytes,
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    errorThrown = true
  }

  if (!errorThrown) {
    throw new Error(
      'Expected build to throw an error with a bad encryption key but it did not'
    )
  }

  errorThrown = false
  try {
    await Client.create(adaptEthersWalletToSigner(alixWallet), {
      env: 'local',
      dbEncryptionKey: badKeyBytes,
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    errorThrown = true
  }

  if (!errorThrown) {
    throw new Error(
      'Expected create to throw an error with a bad encryption key but it did not'
    )
  }

  return true
})

test('can manage clients manually', async () => {
  const [bo] = await createClients(1)
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const alix = Wallet.createRandom()

  const signer = adaptEthersWalletToSigner(alix)

  const inboxId = await Client.getOrCreateInboxId(
    await signer.getIdentifier(),
    'local'
  )
  const client = await Client.ffiCreateClient(await signer.getIdentifier(), {
    env: 'local',
    dbEncryptionKey: keyBytes,
  })
  const sigText = await client.ffiCreateSignatureText()
  const signedMessage = await signer.signMessage(sigText)
  const { r, s, v } = ethers.utils.splitSignature(signedMessage.signature)
  const signature = ethers.utils.arrayify(
    ethers.utils.joinSignature({ r, s, v })
  )

  await client.ffiAddEcdsaSignature(signature)
  await client.ffiRegisterIdentity()

  const canMessage = await bo.canMessage([client.publicIdentity])
  assert(
    canMessage[client.publicIdentity.identifier.toLowerCase()] === true,
    `should be able to message ${canMessage[client.publicIdentity.identifier.toLowerCase()]}`
  )
  assert(
    inboxId === client.inboxId,
    `${inboxId} does not match ${client.inboxId}`
  )

  return true
})

test('can manage add remove manually', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const alixWallet = Wallet.createRandom()
  const boWallet = Wallet.createRandom()

  const alixSigner = adaptEthersWalletToSigner(alixWallet)
  const boSigner = adaptEthersWalletToSigner(boWallet)
  const alix = await Client.create(alixSigner, {
    env: 'local',
    dbEncryptionKey: keyBytes,
  })

  let inboxState = await alix.inboxState(true)
  assert(
    inboxState.identities.length === 1,
    `identities length should be 1 but was ${inboxState.identities.length}`
  )

  const sigText = await alix.ffiAddIdentitySignatureText(
    await boSigner.getIdentifier()
  )
  const signedMessage = await boSigner.signMessage(sigText)

  let { r, s, v } = ethers.utils.splitSignature(signedMessage.signature)
  const signature = ethers.utils.arrayify(
    ethers.utils.joinSignature({ r, s, v })
  )

  await alix.ffiAddEcdsaSignature(signature)
  await alix.ffiApplySignature()

  inboxState = await alix.inboxState(true)
  assert(
    inboxState.identities.length === 2,
    `identities length should be 2 but was ${inboxState.identities.length}`
  )

  const sigText2 = await alix.ffiRemoveIdentitySignatureText(
    await boSigner.getIdentifier()
  )
  const signedMessage2 = await alixSigner.signMessage(sigText2)

  ;({ r, s, v } = ethers.utils.splitSignature(signedMessage2.signature))
  const signature2 = ethers.utils.arrayify(
    ethers.utils.joinSignature({ r, s, v })
  )

  await alix.ffiAddEcdsaSignature(signature2)
  await alix.ffiApplySignature()

  inboxState = await alix.inboxState(true)
  assert(
    inboxState.identities.length === 1,
    `identities length should be 1 but was ${inboxState.identities.length}`
  )

  return true
})

test('can manage revoke manually', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dbDirPath = `${RNFS.DocumentDirectoryPath}/xmtp_db`
  const dbDirPath2 = `${RNFS.DocumentDirectoryPath}/xmtp_db2`
  const dbDirPath3 = `${RNFS.DocumentDirectoryPath}/xmtp_db3`
  const directoryExists = await RNFS.exists(dbDirPath)
  if (!directoryExists) {
    await RNFS.mkdir(dbDirPath)
  }
  const directoryExists2 = await RNFS.exists(dbDirPath2)
  if (!directoryExists2) {
    await RNFS.mkdir(dbDirPath2)
  }
  const directoryExists3 = await RNFS.exists(dbDirPath3)
  if (!directoryExists3) {
    await RNFS.mkdir(dbDirPath3)
  }
  const alixWallet = Wallet.createRandom()
  const alixSigner = adaptEthersWalletToSigner(alixWallet)

  const alix = await Client.create(alixSigner, {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath,
  })

  const alix2 = await Client.create(alixSigner, {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath2,
  })

  await Client.create(alixSigner, {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath3,
  })

  let inboxState = await alix.inboxState(true)
  assert(
    inboxState.installations.length === 3,
    `installations length should be 3 but was ${inboxState.installations.length}`
  )

  const sigText = await alix.ffiRevokeInstallationsSignatureText([
    alix2.installationId,
  ])
  const signedMessage = await alixSigner.signMessage(sigText)

  let { r, s, v } = ethers.utils.splitSignature(signedMessage.signature)
  const signature = ethers.utils.arrayify(
    ethers.utils.joinSignature({ r, s, v })
  )

  await alix.ffiAddEcdsaSignature(signature)
  await alix.ffiApplySignature()

  inboxState = await alix.inboxState(true)
  assert(
    inboxState.installations.length === 2,
    `installations length should be 2 but was ${inboxState.installations.length}`
  )

  const sigText2 = await alix.ffiRevokeAllOtherInstallationsSignatureText()
  const signedMessage2 = await alixSigner.signMessage(sigText2)

  ;({ r, s, v } = ethers.utils.splitSignature(signedMessage2.signature))
  const signature2 = ethers.utils.arrayify(
    ethers.utils.joinSignature({ r, s, v })
  )

  await alix.ffiAddEcdsaSignature(signature2)
  await alix.ffiApplySignature()

  inboxState = await alix.inboxState(true)
  assert(
    inboxState.installations.length === 1,
    `installations length should be 1 but was ${inboxState.installations.length}`
  )

  return true
})

test('can drop client from memory', async () => {
  const [client, anotherClient] = await createClients(2)
  await client.dropLocalDatabaseConnection()
  await anotherClient.dropLocalDatabaseConnection()

  await client.reconnectLocalDatabase()
  await Client.dropClient(anotherClient.installationId)
  try {
    await anotherClient.reconnectLocalDatabase()
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // We cannot reconnect anotherClient because it was successfully dropped
    return true
  }
})

test('can drop a local database', async () => {
  const [client, anotherClient] = await createClients(2)

  const group = await client.conversations.newGroup([anotherClient.inboxId])
  await client.conversations.sync()
  assert(
    (await client.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await client.conversations.listGroups()).length
    }`
  )

  await client.dropLocalDatabaseConnection()
  await new Promise((resolve) => setTimeout(resolve, 1000))

  try {
    await group.send('hi')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    await client.reconnectLocalDatabase()
    await group.send('hi')
    return true
  }
  throw new Error('should throw when local database not connected')
})

test('can revoke installations', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dbDirPath = `${RNFS.DocumentDirectoryPath}/xmtp_db`
  const dbDirPath2 = `${RNFS.DocumentDirectoryPath}/xmtp_db2`
  const dbDirPath3 = `${RNFS.DocumentDirectoryPath}/xmtp_db3`
  const directoryExists = await RNFS.exists(dbDirPath)
  if (!directoryExists) {
    await RNFS.mkdir(dbDirPath)
  }
  const directoryExists2 = await RNFS.exists(dbDirPath2)
  if (!directoryExists2) {
    await RNFS.mkdir(dbDirPath2)
  }
  const directoryExists3 = await RNFS.exists(dbDirPath3)
  if (!directoryExists3) {
    await RNFS.mkdir(dbDirPath3)
  }
  const alixWallet = Wallet.createRandom()

  // create a v3 client
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

  const alix3 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath3,
  })

  const inboxState2 = await alix3.inboxState(true)
  assert(
    inboxState2.installations.length === 3,
    `installations length should be 3 but was ${inboxState2.installations.length}`
  )

  await alix3.revokeInstallations(adaptEthersWalletToSigner(alixWallet), [
    alix2.installationId,
  ])

  const inboxState3 = await alix3.inboxState(true)
  assert(
    inboxState3.installations.length === 2,
    `installations length should be 2 but was ${inboxState3.installations.length}`
  )

  await alix.dropLocalDatabaseConnection()
  await alix2.dropLocalDatabaseConnection()
  await alix3.dropLocalDatabaseConnection()

  await new Promise((resolve) => setTimeout(resolve, 1000))

  await alix.deleteLocalDatabase()
  await alix2.deleteLocalDatabase()
  await alix3.deleteLocalDatabase()

  await new Promise((resolve) => setTimeout(resolve, 1000))

  return true
})

test('can upload archive debug information', async () => {
  const [alix] = await createClients(1)
  const uploadKey = await alix.debugInformation.uploadDebugInformation()

  assert(
    typeof uploadKey === 'string' && uploadKey.length > 0,
    'uploadKey should not be empty'
  )

  return true
})

test('can create, inspect, import and resync archive', async () => {
  const [bo] = await createClients(1)
  const key = crypto.getRandomValues(new Uint8Array(32))
  const encryptionKey = crypto.getRandomValues(new Uint8Array(32))

  const dbPath1 = `${RNFS.DocumentDirectoryPath}/xmtp_test1`
  const dbPath2 = `${RNFS.DocumentDirectoryPath}/xmtp_test2`
  const allPath = `${dbPath1}/testAll.zstd`
  const consentPath = `${dbPath1}/testConsent.zstd`

  await RNFS.mkdir(dbPath1)
  await RNFS.mkdir(dbPath2)

  const alixWallet = Wallet.createRandom()
  const alix = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: key,
    dbDirectory: dbPath1,
  })

  const group = await alix.conversations.newGroup([bo.inboxId])
  await group.send('hi')

  await alix.conversations.syncAllConversations()
  await bo.conversations.syncAllConversations()

  // Create full archive and consent-only archive
  await alix.createArchive(allPath, encryptionKey)
  await alix.createArchive(
    consentPath,
    encryptionKey,
    new ArchiveOptions(['consent'])
  )

  const metadataAll = await alix.archiveMetadata(allPath, encryptionKey)
  const metadataConsent = await alix.archiveMetadata(consentPath, encryptionKey)

  assert(
    metadataAll.elements.length === 2,
    'Expected 2 elements in full archive'
  )
  assert(
    metadataConsent.elements.length === 1 &&
      metadataConsent.elements[0] === 'consent',
    `Expected only 'CONSENT' in consent archive`
  )

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: key,
    dbDirectory: dbPath2,
  })

  await alix2.importArchive(allPath, encryptionKey)

  await delayToPropogate(2000)
  await alix2.conversations.syncAllConversations()
  await delayToPropogate(2000)
  await alix.preferences.sync()
  await delayToPropogate(2000)
  await alix2.preferences.sync()
  await delayToPropogate(2000)

  const boGroup = await bo.conversations.findConversation(group.id)
  await boGroup?.send('hey')

  await bo.conversations.syncAllConversations()
  await delayToPropogate(2000)
  await alix2.conversations.syncAllConversations()

  const convos = await alix2.conversations.list()
  assert(convos.length === 1, `Expected 1 conversation, got ${convos.length}`)

  const convo = convos[0]
  await convo.sync()
  const messages = await convo.messages()
  const state = await convo.consentState()

  assert(messages.length === 3, `Expected 3 messages, got ${messages.length}`)
  assert(state === 'allowed', `Expected 'allowed' state, got ${state}`)

  return true
})

// 🧪 2. Inactive DMs can be stitched if duplicated

test('can stitch inactive DMs if duplicated after archive import', async () => {
  const [bo] = await createClients(1)
  const key = crypto.getRandomValues(new Uint8Array(32))
  const encryptionKey = crypto.getRandomValues(new Uint8Array(32))

  const dbPath1 = `${RNFS.DocumentDirectoryPath}/xmtp_test1`
  const dbPath2 = `${RNFS.DocumentDirectoryPath}/xmtp_test2`
  const archivePath = `${dbPath1}/testAll.zstd`

  await RNFS.mkdir(dbPath1)
  await RNFS.mkdir(dbPath2)

  const alixWallet = Wallet.createRandom()
  const alix = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: key,
    dbDirectory: dbPath1,
  })

  const dm = await alix.conversations.findOrCreateDm(bo.inboxId)
  await dm.send('hi')

  await alix.conversations.syncAllConversations()
  await bo.conversations.syncAllConversations()

  const boDm = await bo.conversations.findConversation(dm.id)

  await alix.createArchive(archivePath, encryptionKey)

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: key,
    dbDirectory: dbPath2,
  })
  await alix2.importArchive(archivePath, encryptionKey)
  await alix2.conversations.syncAllConversations()

  const convos = await alix2.conversations.list()
  assert(convos.length === 1, `Expected 1 conversation, got ${convos.length}`)
  assert(!(await convos[0].isActive()), 'Expected conversation to be inactive')

  const dm2 = await alix.conversations.findOrCreateDm(bo.inboxId)
  assert(await dm2.isActive(), 'Expected new DM to be active')

  await boDm?.send('hey')
  await dm2.send('hey')
  await bo.conversations.syncAllConversations()
  await delayToPropogate(2000)
  await alix2.conversations.syncAllConversations()

  const convos2 = await alix2.conversations.list()
  assert(convos2.length === 1, 'Expected deduplicated convo count to be 1')

  const dm2Messages = await dm2.messages()
  const boDmMessages = await boDm?.messages()
  assert(
    dm2Messages.length === 4,
    `Expected 4 messages in DM2, got ${dm2Messages.length}`
  )
  assert(
    boDmMessages?.length === 4,
    `Expected 4 messages in boDm, got ${boDmMessages?.length}`
  )

  return true
})

// 🧪 3. Import works even on full database

test('can import archive on top of full database', async () => {
  const [alix, bo] = await createClients(2)
  const encryptionKey = crypto.getRandomValues(new Uint8Array(32))
  const dbPath = `${RNFS.DocumentDirectoryPath}/xmtp_test1`
  const archivePath = `${dbPath}/testAll.zstd`

  await RNFS.mkdir(dbPath)

  const group = await alix.conversations.newGroup([bo.inboxId])
  const dm = await alix.conversations.findOrCreateDm(bo.inboxId)

  await group.send('First')
  await dm.send('hi')

  await alix.conversations.syncAllConversations()
  await bo.conversations.syncAllConversations()

  const boGroup = await bo.conversations.findConversation(group.id)

  const groupMessages1 = await group.messages()
  const boGroupMessages1 = await boGroup?.messages()
  const alixConvoCount1 = (await alix.conversations.list()).length
  const boConvoCount1 = (await bo.conversations.list()).length

  assert(groupMessages1.length === 2, 'Expected 2 messages in group')
  assert(boGroupMessages1?.length === 2, 'Expected 2 messages in boGroup')
  assert(alixConvoCount1 === 2, 'Expected 2 convos for alix')
  assert(boConvoCount1 === 2, 'Expected 2 convos for bo')

  await alix.createArchive(archivePath, encryptionKey)
  await group.send('Second')
  await alix.importArchive(archivePath, encryptionKey)
  await group.send('Third')
  await dm.send('hi')

  await alix.conversations.syncAllConversations()
  await bo.conversations.syncAllConversations()

  const groupMessages2 = await group.messages()
  const boGroupMessages2 = await boGroup?.messages()
  const alixConvoCount2 = (await alix.conversations.list()).length
  const boConvoCount2 = (await bo.conversations.list()).length

  assert(
    groupMessages2.length === 4,
    'Expected 4 messages in group after import'
  )
  assert(
    boGroupMessages2?.length === 4,
    'Expected 4 messages in boGroup after import'
  )
  assert(alixConvoCount2 === 2, 'Expected 2 convos for alix after import')
  assert(boConvoCount2 === 2, 'Expected 2 convos for bo after import')

  return true
})
