import { ethers, Wallet } from 'ethers'
import RNFS from 'react-native-fs'

import {
  Test,
  assert,
  createClients,
  adaptEthersWalletToSigner,
  assertEqual,
} from './test-utils'
import { Client, PublicIdentity } from '../../../src/index'

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
    dbEncryptionKey: keyBytes,
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
    dbEncryptionKey: keyBytes,
  })

  await alix.deleteLocalDatabase()

  const alix2 = await Client.create(adaptEthersWalletToSigner(alixWallet), {
    env: 'local',
    dbEncryptionKey: keyBytes,
  })

  await alix2.deleteLocalDatabase()

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
  await client.deleteLocalDatabase()
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
  const { r, s, v } = ethers.utils.splitSignature(signedMessage)
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

  const sigText = await alix.ffiAddWalletSignatureText(
    await boSigner.getIdentifier()
  )
  const signedMessage = await boSigner.signMessage(sigText)

  let { r, s, v } = ethers.utils.splitSignature(signedMessage)
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

  const sigText2 = await alix.ffiRemoveWalletSignatureText(
    await boSigner.getIdentifier()
  )
  const signedMessage2 = await alixSigner.signMessage(sigText2)

  ;({ r, s, v } = ethers.utils.splitSignature(signedMessage2))
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

  let { r, s, v } = ethers.utils.splitSignature(signedMessage)
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

  ;({ r, s, v } = ethers.utils.splitSignature(signedMessage2))
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
