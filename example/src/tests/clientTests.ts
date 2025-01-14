import { Wallet } from 'ethers'
import RNFS from 'react-native-fs'

import {
  Test,
  assert,
  createClients,
  adaptEthersWalletToSigner,
} from './test-utils'
import { Client } from '../../../src/index'

export const clientTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  clientTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('can make a client', async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const client = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    dbEncryptionKey: keyBytes,
  })

  const inboxId = await Client.getOrCreateInboxId(client.address, 'local')

  assert(
    client.inboxId === inboxId,
    `inboxIds should match but were ${client.inboxId} and ${inboxId}`
  )
  return true
})

test('static can message', async () => {
  const [alix, bo] = await createClients(2)

  const addressMap = await Client.canMessage('local', [
    alix.address,
    '0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67',
    bo.address,
  ])

  assert(
    addressMap[
      '0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67'.toLocaleLowerCase()
    ] === false,
    `should not be able to message 0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67`
  )

  assert(
    addressMap[alix.address.toLowerCase()] === true,
    `should be able to message ${alix.address}`
  )

  assert(
    addressMap[bo.address.toLowerCase()] === true,
    `should be able to message ${bo.address}`
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
    inboxStates[0].recoveryAddress.toLowerCase === alix.address.toLowerCase,
    `inbox state should be ${alix.address.toLowerCase} but was ${inboxStates[0].recoveryAddress.toLowerCase}`
  )

  assert(
    inboxStates[1].recoveryAddress.toLowerCase === bo.address.toLowerCase,
    `inbox state should be ${bo.address.toLowerCase} but was ${inboxStates[1].recoveryAddress.toLowerCase}`
  )

  return true
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
    appVersion: 'Testing/0.0.0',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath,
  })

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    dbEncryptionKey: keyBytes,
    dbDirectory: dbDirPath2,
  })

  const alix3 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    appVersion: 'Testing/0.0.0',
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
  await alix.deleteLocalDatabase()
  await alix2.deleteLocalDatabase()
  await alix3.deleteLocalDatabase()

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
    appVersion: 'Testing/0.0.0',
    dbEncryptionKey: keyBytes,
  })

  await alix.deleteLocalDatabase()

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    dbEncryptionKey: keyBytes,
  })

  await alix2.deleteLocalDatabase()

  const alix3 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    appVersion: 'Testing/0.0.0',
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

  await client.conversations.newGroup([anotherClient.address])
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
  await client.deleteLocalDatabase()
  client = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
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
    appVersion: 'Testing/0.0.0',
    dbEncryptionKey: key,
    dbDirectory: dbDirPath,
  })

  const anotherClient = await Client.createRandom({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    dbEncryptionKey: key,
  })

  await client.conversations.newGroup([anotherClient.address])
  assert(
    (await client.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await client.conversations.listGroups()).length
    }`
  )

  const clientFromBundle = await Client.build(client.address, {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    dbEncryptionKey: key,
    dbDirectory: dbDirPath,
  })

  assert(
    clientFromBundle.address === client.address,
    `clients dont match ${client.address} and ${clientFromBundle.address}`
  )

  assert(
    (await clientFromBundle.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await clientFromBundle.conversations.listGroups()).length
    }`
  )
  return true
})

test('can drop a local database', async () => {
  const [client, anotherClient] = await createClients(2)

  const group = await client.conversations.newGroup([anotherClient.address])
  await client.conversations.sync()
  assert(
    (await client.conversations.listGroups()).length === 1,
    `should have a group size of 1 but was ${
      (await client.conversations.listGroups()).length
    }`
  )

  await client.dropLocalDatabaseConnection()

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

test('can get a inboxId from an address', async () => {
  const [alix, bo] = await createClients(2)

  const boInboxId = await alix.findInboxIdFromAddress(bo.address)
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
      appVersion: 'Testing/0.0.0',
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
    states[0].recoveryAddress.toLowerCase === bo.address.toLowerCase,
    `addresses dont match ${states[0].recoveryAddress} and ${bo.address}`
  )
  assert(
    states[1].addresses[0].toLowerCase === caro.address.toLowerCase,
    `clients dont match ${states[1].addresses[0]} and ${caro.address}`
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
    appVersion: 'Testing/0.0.0',
    dbEncryptionKey: keyBytes,
  })

  await alix.addAccount(adaptEthersWalletToSigner(alixWallet2))
  await alix.addAccount(adaptEthersWalletToSigner(alixWallet3))

  const inboxState = await alix.inboxState(true)
  assert(
    inboxState.addresses.length === 3,
    `addresses length should be 3 but was ${inboxState.addresses.length}`
  )
  assert(
    inboxState.installations.length === 1,
    `addresses length should be 1 but was ${inboxState.installations.length}`
  )
  assert(
    inboxState.recoveryAddress === alix.address.toLowerCase(),
    `recovery address should be ${alix.address} but was ${inboxState.recoveryAddress}`
  )

  await alix.removeAccount(
    adaptEthersWalletToSigner(alixWallet),
    await alixWallet3.getAddress()
  )
  const inboxState2 = await alix.inboxState(true)
  assert(
    inboxState2.addresses.length === 2,
    `addresses length should be 2 but was ${inboxState.addresses.length}`
  )

  return true
})
