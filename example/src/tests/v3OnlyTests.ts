/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-extra-non-null-assertion */
import { Client } from 'xmtp-react-native-sdk'

import {
  Test,
  assert,
  createV3TestingClients,
  delayToPropogate,
} from './test-utils'

export const v3OnlyTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  v3OnlyTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('can make a V3 only client', async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const client = await Client.createRandomV3({
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: keyBytes,
  })

  const inboxId = await Client.getOrCreateInboxId(client.address, {
    env: 'local',
  })

  assert(
    client.inboxId === inboxId,
    `inboxIds should match but were ${client.inboxId} and ${inboxId}`
  )

  const client2 = await Client.buildV3(client.address, {
    env: 'local',
    appVersion: 'Testing/0.0.0',
    enableV3: true,
    dbEncryptionKey: keyBytes,
  })

  assert(
    client.inboxId === client2.inboxId,
    `inboxIds should match but were ${client.inboxId} and ${client2.inboxId}`
  )

  const canMessageV3 = await client.canGroupMessage([client.address])
  assert(
    canMessageV3[client.address.toLowerCase()] === true,
    `canMessageV3 should be true`
  )
  try {
    await client.canMessage(client.address)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return true
  }
  throw new Error('should throw error when hitting V2 api')
})

test('can create group', async () => {
  const [alixV2, boV3, caroV2V3] = await createV3TestingClients()
  const group = await boV3.conversations.newGroup([caroV2V3.address])
  assert(group?.members?.length === 2, `group should have 2 members`)

  try {
    await boV3.conversations.newGroup([alixV2.address])
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return true
  }
  throw new Error(
    'should throw error when trying to add a V2 only client to a group'
  )
})

test('can send message', async () => {
  const [alixV2, boV3, caroV2V3] = await createV3TestingClients()
  const group = await boV3.conversations.newGroup([caroV2V3.address])
  await group.send('gm')
  await group.sync()
  const groupMessages = await group.messages()
  assert(
    groupMessages[0].content() === 'gm',
    `first should be gm but was ${groupMessages[0].content()}`
  )

  await caroV2V3.conversations.syncGroups()
  const sameGroups = await caroV2V3.conversations.listGroups()
  await sameGroups[0].sync()

  const sameGroupMessages = await sameGroups[0].messages()
  assert(
    sameGroupMessages[0].content() === 'gm',
    `second should be gm but was ${sameGroupMessages[0].content()}`
  )
  return true
})

test('can group consent', async () => {
  const [alixV2, boV3, caroV2V3] = await createV3TestingClients()
  const group = await boV3.conversations.newGroup([caroV2V3.address])

  const isAllowed = await boV3.contacts.isGroupAllowed(group.id)
  assert(isAllowed === true, `isAllowed should be true but was ${isAllowed}`)
  let groupState = await group.state
  assert(
    groupState === 'allowed',
    `group state should be allowed but was ${groupState}`
  )

  await boV3.contacts.denyGroups([group.id])

  const isDenied = await boV3.contacts.isGroupDenied(group.id)
  assert(isDenied === true, `isDenied should be true but was ${isDenied}`)
  groupState = await group.consentState()
  assert(
    groupState === 'denied',
    `group state should be denied but was ${groupState}`
  )

  await group.updateConsent('allowed')

  const isAllowed2 = await boV3.contacts.isGroupAllowed(group.id)
  assert(isAllowed2 === true, `isAllowed2 should be true but was ${isAllowed2}`)
  groupState = await group.consentState()
  assert(
    groupState === 'allowed',
    `group state should be allowed but was ${groupState}`
  )

  return true
})

test('can allow and deny inbox ids', async () => {
  const [alixV2, boV3, caroV2V3] = await createV3TestingClients()
  const boGroup = await boV3.conversations.newGroup([caroV2V3.address])

  let isInboxAllowed = await boV3.contacts.isInboxAllowed(caroV2V3.inboxId)
  let isInboxDenied = await boV3.contacts.isInboxDenied(caroV2V3.inboxId)
  assert(
    isInboxAllowed === false,
    `isInboxAllowed should be false but was ${isInboxAllowed}`
  )
  assert(
    isInboxDenied === false,
    `isInboxDenied should be false but was ${isInboxDenied}`
  )

  await boV3.contacts.allowInboxes([caroV2V3.inboxId])

  let caroMember = (await boGroup.membersList()).find(
    (member) => member.inboxId === caroV2V3.inboxId
  )
  assert(
    caroMember?.consentState === 'allowed',
    `caroMember should be allowed but was ${caroMember?.consentState}`
  )

  isInboxAllowed = await boV3.contacts.isInboxAllowed(caroV2V3.inboxId)
  isInboxDenied = await boV3.contacts.isInboxDenied(caroV2V3.inboxId)
  assert(
    isInboxAllowed === true,
    `isInboxAllowed2 should be true but was ${isInboxAllowed}`
  )
  assert(
    isInboxDenied === false,
    `isInboxDenied2 should be false but was ${isInboxDenied}`
  )

  let isAddressAllowed = await boV3.contacts.isAllowed(caroV2V3.address)
  let isAddressDenied = await boV3.contacts.isDenied(caroV2V3.address)
  assert(
    isAddressAllowed === true,
    `isAddressAllowed should be true but was ${isAddressAllowed}`
  )
  assert(
    isAddressDenied === false,
    `isAddressDenied should be false but was ${isAddressDenied}`
  )

  await boV3.contacts.denyInboxes([caroV2V3.inboxId])

  caroMember = (await boGroup.membersList()).find(
    (member) => member.inboxId === caroV2V3.inboxId
  )
  assert(
    caroMember?.consentState === 'denied',
    `caroMember should be denied but was ${caroMember?.consentState}`
  )

  isInboxAllowed = await boV3.contacts.isInboxAllowed(caroV2V3.inboxId)
  isInboxDenied = await boV3.contacts.isInboxDenied(caroV2V3.inboxId)
  assert(
    isInboxAllowed === false,
    `isInboxAllowed3 should be false but was ${isInboxAllowed}`
  )
  assert(
    isInboxDenied === true,
    `isInboxDenied3 should be true but was ${isInboxDenied}`
  )

  await boV3.contacts.allow([alixV2.address])

  isAddressAllowed = await boV3.contacts.isAllowed(alixV2.address)
  isAddressDenied = await boV3.contacts.isDenied(alixV2.address)
  assert(
    isAddressAllowed === true,
    `isAddressAllowed2 should be true but was ${isAddressAllowed}`
  )
  assert(
    isAddressDenied === false,
    `isAddressDenied2 should be false but was ${isAddressDenied}`
  )

  return true
})

test('can stream all messages', async () => {
  const [alixV2, boV3, caroV2V3] = await createV3TestingClients()
  const conversation = await alixV2.conversations.newConversation(
    caroV2V3.address
  )
  const group = await boV3.conversations.newGroup([caroV2V3.address])
  await caroV2V3.conversations.syncGroups()

  const allMessages: any[] = []

  await caroV2V3.conversations.streamAllMessages(async (conversation) => {
    allMessages.push(conversation)
  }, true)

  await conversation.send('hi')
  await group.send('hi')

  assert(allMessages.length === 2, '2 messages should have been streamed')

  return true
})

test('can stream groups and conversations', async () => {
  const [alixV2, boV3, caroV2V3] = await createV3TestingClients()

  const allConvos: any[] = []

  await caroV2V3.conversations.streamAll(async (conversation) => {
    allConvos.push(conversation)
  })

  await alixV2.conversations.newConversation(caroV2V3.address)
  await boV3.conversations.newGroup([caroV2V3.address])

  await delayToPropogate()

  assert(allConvos.length === 2, '2 convos should have been streamed')

  return true
})
