import { Wallet } from 'ethers'
import { DefaultContentTypes } from 'xmtp-react-native-sdk/lib/types/DefaultContentType'
import { PermissionPolicySet } from 'xmtp-react-native-sdk/lib/types/PermissionPolicySet'

import {
  Test,
  assert,
  createClients,
  createGroups,
  delayToPropogate,
  adaptEthersWalletToSigner,
  assertEqual,
} from './test-utils'
import {
  Client,
  Conversation,
  Group,
  GroupUpdatedContent,
  GroupUpdatedCodec,
  DecodedMessage,
  ConsentRecord,
  PublicIdentity,
} from '../../../src/index'

export const groupTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  groupTests.push({ name: String(counter++) + '. ' + name, run: perform })
}

test('verify exportNativeLogs', async () => {
  await createClients(2)
  const logs = await Client.exportNativeLogs()
  assert(
    logs.includes('Created XMTP client for inbox_id'),
    'Logs should contain Initialized identity inbox_id='
  )
  return true
})

test('can create a group with inbox ids default permissions', async () => {
  const [alix, bo, caro] = await createClients(3)

  // Create group with inbox ID
  const boGroup = await bo.conversations.newGroupWithIdentities([
    alix.publicIdentity,
  ])

  await alix.conversations.sync()
  await boGroup.sync()

  const alixGroups = await alix.conversations.listGroups()
  const alixGroup = alixGroups[0]

  // Verify group IDs are not empty
  assert(boGroup.id !== '', 'bo group ID should not be empty')
  assert(alixGroup.id !== '', 'alix group ID should not be empty')

  // Add caro to group
  await alixGroup.addMembers([caro.inboxId])
  await boGroup.sync()

  // Verify member counts
  assert(
    (await alixGroup.members()).length === 3,
    'alix group should have 3 members'
  )
  assert(
    (await boGroup.members()).length === 3,
    'bo group should have 3 members'
  )

  // Verify remove members throws error (admin only)
  try {
    await alixGroup.removeMembers([caro.inboxId])
    await boGroup.sync()
    throw new Error('Should not be able to remove members')
  } catch {
    // Expected error
  }

  // Verify member counts unchanged
  assert(
    (await alixGroup.members()).length === 3,
    'alix group should still have 3 members'
  )
  assert(
    (await boGroup.members()).length === 3,
    'bo group should still have 3 members'
  )

  // Check permissions
  const boPermissions = await boGroup.permissionPolicySet()
  const alixPermissions = await alixGroup.permissionPolicySet()

  assert(
    boPermissions.addMemberPolicy === 'allow',
    'bo group should have allow add member policy'
  )
  assert(
    alixPermissions.addMemberPolicy === 'allow',
    'alix group should have allow add member policy'
  )

  // Check super admin status
  assert(
    await boGroup.isSuperAdmin(bo.inboxId),
    'bo should be super admin in bo group'
  )
  assert(
    !(await boGroup.isSuperAdmin(alix.inboxId)),
    'alix should not be super admin in bo group'
  )
  assert(
    await alixGroup.isSuperAdmin(bo.inboxId),
    'bo should be super admin in alix group'
  )
  assert(
    !(await alixGroup.isSuperAdmin(alix.inboxId)),
    'alix should not be super admin in alix group'
  )

  return true
})

test('groups cannot fork', async () => {
  const [alix, bo, caro] = await createClients(3)
  // Create group with 3 users
  const { id: groupId } = await alix.conversations.newGroup([
    bo.inboxId,
    caro.inboxId,
  ])

  const getGroupForClient = async (client: Client) => {
    // Always sync the client before getting the group
    await client.conversations.sync()
    const group = await client.conversations.findGroup(groupId)
    assert(group !== undefined, `Group not found for ${client.inboxId}`)
    return group as Group<DefaultContentTypes>
  }

  const syncClientAndGroup = async (client: Client) => {
    const group = await getGroupForClient(client)
    await group.sync()
  }

  const addMemberToGroup = async (fromClient: Client, addresses: string[]) => {
    await syncClientAndGroup(fromClient)
    const group = await getGroupForClient(fromClient)
    await group.addMembers(addresses)
    await delayToPropogate(500)
  }

  const removeMemberFromGroup = async (
    fromClient: Client,
    addresses: string[]
  ) => {
    await syncClientAndGroup(fromClient)
    const group = await getGroupForClient(fromClient)
    await group.removeMembers(addresses)
    await delayToPropogate(500)
  }

  // Helper to send a message from a bunch of senders and make sure it is received by all receivers
  const testMessageSending = async (senderClient: Client, receiver: Client) => {
    // for (const senderClient of senders) {
    const messageContent = Math.random().toString(36)
    await syncClientAndGroup(senderClient)
    const senderGroup = await getGroupForClient(senderClient)
    await senderGroup.send(messageContent)

    await delayToPropogate(500)
    await senderGroup.sync()

    await syncClientAndGroup(receiver)

    const receiverGroupToCheck = await getGroupForClient(receiver)
    await receiverGroupToCheck.sync()

    const messages = await receiverGroupToCheck.messages({
      direction: 'DESCENDING',
    })
    const lastMessage = messages[0]
    // console.log(lastMessage);
    console.log(
      `${receiverGroupToCheck.client.installationId} sees ${messages.length} messages in group`
    )
    assert(
      lastMessage !== undefined &&
        lastMessage.nativeContent.text === messageContent,
      `${receiverGroupToCheck.client.installationId} should have received the message, FORK? ${lastMessage?.nativeContent.text} !== ${messageContent}`
    )
    // }
  }

  console.log('Testing that messages sent by alix are received by bo')
  await testMessageSending(alix, bo)
  console.log('Alix & Bo are not forked at the beginning')

  // Test adding members one by one
  // console.log('Testing adding members one by one...')
  const newClients = await createClients(2)

  // Add back several members
  console.log('Adding new members to the group...')
  for (const client of newClients) {
    console.log(`Adding member ${client.inboxId}...`)
    await addMemberToGroup(alix, [client.inboxId])
  }
  await delayToPropogate()

  await alix.conversations.sync()
  await syncClientAndGroup(alix)

  // NB => if we don't use Promise.all but a loop, we don't get a fork
  const REMOVE_MEMBERS_IN_PARALLEL = true
  if (REMOVE_MEMBERS_IN_PARALLEL) {
    console.log('Removing members in parallel')

    await Promise.all(
      newClients.map((client) => {
        console.log(`Removing member ${client.inboxId}...`)
        return removeMemberFromGroup(alix, [client.inboxId])
      })
    )
  } else {
    console.log('Removing members one by one')

    for (const client of newClients) {
      console.log(`Removing member ${client.inboxId}...`)
      await removeMemberFromGroup(alix, [client.inboxId])
    }
  }

  await delayToPropogate(1000)

  // When forked, it stays forked even if we try 5 times
  // but sometimes it is not forked and works 5/5 times
  let forkCount = 0
  const tryCount = 5
  for (let i = 0; i < tryCount; i++) {
    console.log(`Checking fork status ${i + 1}/${tryCount}`)
    try {
      await syncClientAndGroup(alix)
      await syncClientAndGroup(bo)
      await delayToPropogate(500)
      await testMessageSending(alix, bo)
      console.log('Not forked!')
    } catch (e: any) {
      console.log('Forked!')
      console.log(e)
      forkCount++
    }
  }

  assert(forkCount === 0, `Forked ${forkCount}/${tryCount} times`)

  return true
})

test('groups cannot fork short version', async () => {
  const [alix, bo, new_one, new_two] = await createClients(4)
  // Create group with 2 users
  const alixGroup = await alix.conversations.newGroup([
    bo.inboxId,
    new_one.inboxId,
    new_two.inboxId,
  ])

  // sync clients
  await alix.conversations.sync()
  await bo.conversations.sync()
  const boGroup: Group<DefaultContentTypes> = (await bo.conversations.findGroup(
    alixGroup.id
  ))!

  // Remove two members in parallel
  // NB => if we don't use Promise.all but a loop, we don't get a fork
  console.log(
    '*************libxmtp*********************: Removing members in parallel'
  )
  await Promise.all([
    alixGroup.removeMembers([new_one.inboxId]),
    alixGroup.removeMembers([new_two.inboxId]),
  ])

  // Helper to send a message from a bunch of senders and make sure it is received by all receivers
  const testMessageSending = async (
    senderGroup: Group<DefaultContentTypes>,
    receiverGroup: Group<DefaultContentTypes>
  ) => {
    const messageContent = Math.random().toString(36)
    await senderGroup.sync()
    await alixGroup.send(messageContent)

    await delayToPropogate(500)
    await alixGroup.sync()
    await receiverGroup.sync()

    const messages = await receiverGroup.messages({
      direction: 'DESCENDING',
    })
    const lastMessage = messages[0]
    console.log(
      `${receiverGroup.client.installationId} sees ${messages.length} messages in group`
    )
    assert(
      lastMessage !== undefined &&
        lastMessage.nativeContent.text === messageContent,
      `${receiverGroup.client.installationId} should have received the message, FORK? ${lastMessage?.nativeContent.text} !== ${messageContent}`
    )
  }
  // When forked, it stays forked even if we try 5 times
  // but sometimes it is not forked and works 5/5 times
  let forkCount = 0
  const tryCount = 5
  for (let i = 0; i < tryCount; i++) {
    console.log(`Checking fork status ${i + 1}/${tryCount}`)
    try {
      await alixGroup.sync()
      await boGroup.sync()
      await delayToPropogate(500)
      await testMessageSending(alixGroup, boGroup)
      console.log('Not forked!')
    } catch (e: any) {
      console.log('Forked!')
      console.log(e)
      forkCount++
    }
  }
  assert(forkCount === 0, `Forked ${forkCount}/${tryCount} times`)

  return true
})

test('groups cannot fork short version - update metadata', async () => {
  const [alix, bo, new_one, new_two] = await createClients(6)
  // Create group with 2 users
  const alixGroup = await alix.conversations.newGroup([
    bo.inboxId,
    new_one.inboxId,
    new_two.inboxId,
  ])

  // sync clients
  await alix.conversations.sync()
  await bo.conversations.sync()
  const boGroup: Group<DefaultContentTypes> = (await bo.conversations.findGroup(
    alixGroup.id
  ))!

  // Remove two members in parallel
  // NB => if we don't use Promise.all but a loop, we don't get a fork
  console.log(
    '*************libxmtp*********************: Updating metadata in parallel'
  )
  await Promise.all([
    alixGroup.updateName('new name'),
    alixGroup.updateName('new name 2'),
  ])

  // Helper to send a message from a bunch of senders and make sure it is received by all receivers
  const testMessageSending = async (
    senderGroup: Group<DefaultContentTypes>,
    receiverGroup: Group<DefaultContentTypes>
  ) => {
    const messageContent = Math.random().toString(36)
    await senderGroup.sync()
    await alixGroup.send(messageContent)

    await delayToPropogate(500)
    await alixGroup.sync()
    await receiverGroup.sync()

    const messages = await receiverGroup.messages({
      direction: 'DESCENDING',
    })
    const lastMessage = messages[0]
    console.log(
      `${receiverGroup.client.installationId} sees ${messages.length} messages in group`
    )
    assert(
      lastMessage !== undefined &&
        lastMessage.nativeContent.text === messageContent,
      `${receiverGroup.client.installationId} should have received the message, FORK? ${lastMessage?.nativeContent.text} !== ${messageContent}`
    )
  }
  // When forked, it stays forked even if we try 5 times
  // but sometimes it is not forked and works 5/5 times
  let forkCount = 0
  const tryCount = 5
  for (let i = 0; i < tryCount; i++) {
    console.log(`Checking fork status ${i + 1}/${tryCount}`)
    try {
      await alixGroup.sync()
      await boGroup.sync()
      await delayToPropogate(500)
      await testMessageSending(alixGroup, boGroup)
      console.log('Not forked!')
    } catch (e: any) {
      console.log('Forked!')
      console.log(e)
      forkCount++
    }
  }
  assert(forkCount === 0, `Forked ${forkCount}/${tryCount} times`)

  return true
})

test('can cancel streams', async () => {
  const [alix, bo] = await createClients(2)
  let messageCallbacks = 0

  await bo.conversations.streamAllMessages(async () => {
    messageCallbacks++
  })

  const group = await alix.conversations.newGroup([bo.inboxId])
  await group.send('hello')
  await delayToPropogate()

  assert(
    messageCallbacks === 1,
    'message stream should have received 1 message'
  )

  await bo.conversations.cancelStreamAllMessages()
  await delayToPropogate()

  await group.send('hello')
  await group.send('hello')
  await group.send('hello')

  await delayToPropogate()

  assert(
    messageCallbacks === 1,
    'message stream should still only received 1 message'
  )

  await bo.conversations.streamAllMessages(async () => {
    messageCallbacks++
  })

  await delayToPropogate()

  await group.send('hello')
  await delayToPropogate()

  assert(
    messageCallbacks === 2,
    'message stream should have received 2 message'
  )

  return true
})

test('group message delivery status', async () => {
  const [alixClient, boClient] = await createClients(2)
  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])

  await alixGroup.send('hello, world')

  const alixMessages: DecodedMessage[] = await alixGroup.messages()

  assert(
    alixMessages.length === 2,
    `the messages length should be 2 but was ${alixMessages.length}`
  )

  await alixGroup.sync()
  const alixMessages2: DecodedMessage[] = await alixGroup.messages()

  assert(
    alixMessages2.length === 2,
    `the messages length should be 2 but was ${alixMessages.length}`
  )

  assert(
    alixMessages2[0].deliveryStatus === 'PUBLISHED',
    `the message should have a delivery status of PUBLISHED but was ${alixMessages2[0].deliveryStatus}`
  )

  await boClient.conversations.sync()
  const boGroup = (await boClient.conversations.listGroups())[0]
  await boGroup.sync()
  const boMessages: DecodedMessage[] = await boGroup.messages()

  assert(
    boMessages.length === 1,
    `the messages length should be 1 but was ${boMessages.length}`
  )

  assert(
    boMessages[0].deliveryStatus === 'PUBLISHED',
    `the message should have a delivery status of PUBLISHED but was ${boMessages[0].deliveryStatus}`
  )

  return true
})

test('can find a group by id', async () => {
  const [alixClient, boClient] = await createClients(2)
  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])

  await boClient.conversations.sync()
  const boGroup = await boClient.conversations.findGroup(alixGroup.id)

  assert(
    boGroup?.id === alixGroup.id,
    `bo ${boGroup?.id} does not match alix ${alixGroup.id}`
  )
  return true
})

test('can find a message by id', async () => {
  const [alixClient, boClient] = await createClients(2)
  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])
  const alixMessageId = await alixGroup.send('Hello')

  await boClient.conversations.sync()
  const boGroup = await boClient.conversations.findGroup(alixGroup.id)
  await boGroup?.sync()
  const boMessage = await boClient.conversations.findMessage(alixMessageId)

  assert(
    boMessage?.id === alixMessageId,
    `bo message ${boMessage?.id} does not match ${alixMessageId}`
  )
  return true
})

test('who added me to a group', async () => {
  const [alixClient, boClient] = await createClients(2)
  await alixClient.conversations.newGroup([boClient.inboxId])

  await boClient.conversations.sync()
  const boGroup = (await boClient.conversations.listGroups())[0]
  const addedByInboxId = await boGroup.addedByInboxId

  assert(
    addedByInboxId === alixClient.inboxId,
    `addedByInboxId ${addedByInboxId} does not match ${alixClient.inboxId}`
  )
  return true
})

test('can get members of a group', async () => {
  const [alixClient, boClient] = await createClients(2)
  const group = await alixClient.conversations.newGroup([boClient.inboxId])

  const members = await group.members()

  assert(members.length === 2, `Should be 2 members but was ${members.length}`)

  // We can not be sure of the order that members will be returned in
  for (const member of members) {
    // Alix created the group so they are a super admin
    if (
      member.identities[0].identifier.toLocaleLowerCase() ===
      alixClient.inboxId.toLocaleLowerCase()
    ) {
      assert(
        member.permissionLevel === 'super_admin',
        `Should be super_admin but was ${member.permissionLevel}`
      )
    }
    // Bo did not create the group so he defaults to permission level "member"
    if (
      member.identities[0].identifier.toLocaleLowerCase() ===
      boClient.inboxId.toLocaleLowerCase()
    ) {
      assert(
        member.permissionLevel === 'member',
        `Should be member but was ${member.permissionLevel}`
      )
    }
  }
  return true
})

test('can message in a group', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  // alix's num groups start at 0
  let alixGroups = await alixClient.conversations.listGroups()
  if (alixGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.inboxId,
    caroClient.inboxId,
  ])

  // alix's num groups == 1
  await alixClient.conversations.sync()
  alixGroups = await alixClient.conversations.listGroups()
  if (alixGroups.length !== 1) {
    throw new Error('num groups should be 1')
  }

  // alix group should match create time from list function
  assert(alixGroups[0].createdAt === alixGroup.createdAt, 'group create time')

  // alix can confirm memberInboxIds
  await alixGroup.sync()
  const memberInboxIds = await alixGroup.memberInboxIds()
  if (memberInboxIds.length !== 3) {
    throw new Error('num group members should be 3')
  }

  if (
    !(
      memberInboxIds.includes(alixClient.inboxId) &&
      memberInboxIds.includes(boClient.inboxId) &&
      memberInboxIds.includes(caroClient.inboxId)
    )
  ) {
    throw new Error('missing address')
  }

  // alix can send messages
  await alixGroup.send('hello, world')
  await alixGroup.send('gm')

  // bo's num groups == 1
  await boClient.conversations.sync()
  const boGroups = await boClient.conversations.listGroups()
  if (boGroups.length !== 1) {
    throw new Error(
      'num groups for bo should be 1, but it is' + boGroups.length
    )
  }
  await delayToPropogate()
  // bo can read messages from alix
  await boGroups[0].sync()
  const boMessages: DecodedMessage[] = await boGroups[0].messages()

  if (boMessages.length !== 2) {
    throw new Error(
      'num messages for bo should be 2, but it is' + boMessages.length
    )
  }
  if (boMessages[0].content() !== 'gm') {
    throw new Error("newest message should be 'gm'")
  }
  if (boMessages[1].content() !== 'hello, world') {
    throw new Error("newest message should be 'hello, world'")
  }
  // bo can send a message
  await boGroups[0].send('hey guys!')

  // caro's num groups == 1
  await caroClient.conversations.sync()
  const caroGroups = await caroClient.conversations.listGroups()
  if (caroGroups.length !== 1) {
    throw new Error(
      'num groups for caro should be 1, but it is' + caroGroups.length
    )
  }

  // caro can read messages from alix and bo
  await caroGroups[0].sync()
  const caroMessages = await caroGroups[0].messages()

  if (caroMessages.length !== 3) {
    throw new Error(`length should be 3 but was ${caroMessages.length}`)
  }
  if (caroMessages[0].content() !== 'hey guys!') {
    throw new Error(
      `newest Message should be 'hey guys!' but was ${caroMessages[0].content()}`
    )
  }
  if (caroMessages[1].content() !== 'gm') {
    throw new Error(
      `second Message should be 'gm' but was ${caroMessages[1].content()}`
    )
  }

  return true
})

test('unpublished messages handling', async () => {
  // Initialize fixture clients
  const [alixClient, boClient] = await createClients(3)

  // Create a new group with Bob and Alice
  const boGroup = await boClient.conversations.newGroup([alixClient.inboxId])
  assert(
    (await boGroup.consentState()) === 'allowed',
    'consent should be allowed'
  )

  // Sync Alice's client to get the new group
  await alixClient.conversations.sync()
  const alixGroup = await alixClient.conversations.findGroup(boGroup.id)
  if (!alixGroup) {
    throw new Error(`Group not found for id: ${boGroup.id}`)
  }

  // Check if the group is allowed initially
  const alixGroupState = await alixClient.preferences.conversationConsentState(
    boGroup.id
  )
  if (alixGroupState !== 'unknown') {
    throw new Error('Group should not be allowed initially')
  }

  // Prepare a message in the group
  const preparedMessageId = await alixGroup.prepareMessage('Test text')

  // Verify the message count in the group
  let messageCount = (await alixGroup.messages()).length
  if (messageCount !== 1) {
    throw new Error(`Message count should be 1, but it is ${messageCount}`)
  }

  // Publish the prepared message
  await alixGroup.publishPreparedMessages()

  // Sync the group after publishing the message
  await alixGroup.sync()
  messageCount = (await alixGroup.messages()).length
  if (messageCount !== 1) {
    throw new Error(`Message count should be 1, but it is ${messageCount}`)
  }

  // Check if the group is allowed after preparing the message
  const isGroupAllowed = await alixClient.preferences.conversationConsentState(
    boGroup.id
  )
  if (isGroupAllowed !== 'allowed') {
    throw new Error('Group should be allowed after preparing a message')
  }

  // Retrieve all messages and verify the prepared message ID
  const messages = await alixGroup.messages()
  if (preparedMessageId !== messages[0].id) {
    throw new Error(`Message ID should match the prepared message ID`)
  }

  return true
})

test('can add members to a group', async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3)

  // alix's num groups start at 0
  let alixGroups = await alixClient.conversations.listGroups()
  if (alixGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // bo's num groups start at 0
  let boGroups = await boClient.conversations.listGroups()
  if (boGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // caro's num groups start at 0
  let caroGroups = await caroClient.conversations.listGroups()
  if (caroGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])

  // alix's num groups == 1
  await alixClient.conversations.sync()
  alixGroups = await alixClient.conversations.listGroups()
  if (alixGroups.length !== 1) {
    throw new Error('num groups should be 1')
  }

  // alix can confirm memberInboxIds
  await alixGroup.sync()
  const memberInboxIds = await alixGroup.memberInboxIds()
  if (memberInboxIds.length !== 2) {
    throw new Error('num group members should be 2')
  }
  if (
    !(
      memberInboxIds.includes(alixClient.inboxId) &&
      memberInboxIds.includes(boClient.inboxId)
    )
  ) {
    throw new Error('missing address')
  }

  // alix can send messages
  await alixGroup.send('hello, world')
  await alixGroup.send('gm')

  // bo's num groups == 1
  await boClient.conversations.sync()
  boGroups = await boClient.conversations.listGroups()
  if (boGroups.length !== 1) {
    throw new Error(
      'num groups for bo should be 1, but it is' + boGroups.length
    )
  }

  const memberResult = await alixGroup.addMembers([caroClient.inboxId])

  assert(
    memberResult.addedMembers[0] === caroClient.inboxId,
    `Added member should be ${memberResult.addedMembers[0]}`
  )

  // caro's num groups == 1
  await caroClient.conversations.sync()
  caroGroups = await caroClient.conversations.listGroups()
  if (caroGroups.length !== 1) {
    throw new Error(
      'num groups for caro should be 1, but it is' + caroGroups.length
    )
  }
  await caroGroups[0].sync()
  const caroMessages = await caroGroups[0].messages()
  if (caroMessages.length !== 0) {
    throw new Error('num messages for caro should be 0')
  }

  await boGroups[0].sync()
  const boGroupMembers = await boGroups[0].memberInboxIds()
  if (boGroupMembers.length !== 3) {
    throw new Error('num group members should be 3')
  }

  return true
})

test('can remove members from a group', async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3)

  // alix's num groups start at 0
  let alixGroups = await alixClient.conversations.listGroups()
  if (alixGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // bo's num groups start at 0
  let boGroups = await boClient.conversations.listGroups()
  assert(boGroups.length === 0, 'num groups should be 0')

  // caro's num groups start at 0
  let caroGroups = await caroClient.conversations.listGroups()
  if (caroGroups.length !== 0) {
    throw new Error('num groups should be 0')
  }

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.inboxId,
    caroClient.inboxId,
  ])

  // alix's num groups == 1
  await alixClient.conversations.sync()
  alixGroups = await alixClient.conversations.listGroups()
  if (alixGroups.length !== 1) {
    throw new Error('num groups should be 1')
  }

  // alix can confirm memberInboxIds
  await alixGroup.sync()
  const memberInboxIds = await alixGroup.memberInboxIds()
  if (memberInboxIds.length !== 3) {
    throw new Error('num group members should be 3')
  }
  if (
    !(
      memberInboxIds.includes(alixClient.inboxId) &&
      memberInboxIds.includes(boClient.inboxId)
    )
  ) {
    throw new Error('missing address')
  }

  // alix can send messages
  await alixGroup.send('hello, world')
  await alixGroup.send('gm')

  // bo's num groups == 1
  await boClient.conversations.sync()
  boGroups = await boClient.conversations.listGroups()
  if (boGroups.length !== 1) {
    throw new Error(
      'num groups for bo should be 1, but it is' + boGroups.length
    )
  }

  // caro's num groups == 1
  await caroClient.conversations.sync()
  caroGroups = await caroClient.conversations.listGroups()
  if (caroGroups.length !== 1) {
    throw new Error(
      'num groups for caro should be 1, but it is' + caroGroups.length
    )
  }

  await caroGroups[0].sync()
  if (!caroGroups[0].isActive()) {
    throw new Error('caros group should be active')
  }

  await alixGroup.removeMembers([caroClient.inboxId])
  await alixGroup.sync()
  const alixGroupMembers = await alixGroup.memberInboxIds()
  if (alixGroupMembers.length !== 2) {
    throw new Error(
      'num group members should be 2 but was' + alixGroupMembers.length
    )
  }

  await caroGroups[0].sync()
  if (await caroGroups[0].isActive()) {
    throw new Error('caros group should not be active')
  }

  const caroGroupMembers = await caroGroups[0].memberInboxIds()
  if (caroGroupMembers.length !== 2) {
    throw new Error(
      'num group members should be 2 but was' + caroGroupMembers.length
    )
  }

  return true
})

test('can remove and add members from a group by inbox id', async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3)

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.inboxId,
    caroClient.inboxId,
  ])

  // alix can confirm memberInboxIds
  await alixGroup.sync()
  const memberInboxIds = await alixGroup.memberInboxIds()
  if (memberInboxIds.length !== 3) {
    throw new Error('num group members should be 3')
  }

  await alixGroup.removeMembersByIdentity([caroClient.publicIdentity])
  await alixGroup.sync()
  const alixGroupMembers = await alixGroup.memberInboxIds()
  if (alixGroupMembers.length !== 2) {
    throw new Error('num group members should be 2')
  }

  await alixGroup.addMembersByIdentity([caroClient.publicIdentity])
  await alixGroup.sync()
  const alixGroupMembers2 = await alixGroup.memberInboxIds()
  if (alixGroupMembers2.length !== 3) {
    throw new Error('num group members should be 3')
  }

  return true
})

test('can stream both groups and messages at same time', async () => {
  const [alix, bo] = await createClients(2)

  let groupCallbacks = 0
  let messageCallbacks = 0
  await bo.conversations.stream(async () => {
    groupCallbacks++
  })

  await bo.conversations.streamAllMessages(async () => {
    messageCallbacks++
  })

  const group = await alix.conversations.newGroup([bo.inboxId])
  await group.send('hello')

  await delayToPropogate()
  // await new Promise((resolve) => setTimeout(resolve, 10000))
  assert(
    messageCallbacks === 1,
    'message stream should have received 1 message'
  )
  assert(groupCallbacks === 1, 'group stream should have received 1 group')
  return true
})

test('can stream groups', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  // Start streaming groups
  const groups: Conversation<any>[] = []
  await alixClient.conversations.stream(async (group: Conversation<any>) => {
    groups.push(group)
  }, 'groups')

  // caro creates a group with alix, so stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const caroGroup = await caroClient.conversations.newGroup([
    alixClient.inboxId,
  ])
  await delayToPropogate()
  if ((groups.length as number) !== 1) {
    throw Error('Unexpected num groups (should be 1): ' + groups.length)
  }

  assert((await groups[0].members()).length === 2, 'should be 2')

  // bo creates a group with alix so a stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const boGroup = await boClient.conversations.newGroup([alixClient.inboxId])
  await delayToPropogate()
  if ((groups.length as number) !== 2) {
    throw Error('Unexpected num groups (should be 2): ' + groups.length)
  }

  // * Note alix creating a group does not trigger alix conversations
  // group stream. Workaround is to sync after you create and list manually
  // See https://github.com/xmtp/libxmtp/issues/504

  // alix creates a group
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.inboxId,
    caroClient.inboxId,
  ])
  await delayToPropogate()
  if (groups.length !== 3) {
    throw Error('Expected group length 3 but it is: ' + groups.length)
  }
  // Sync groups after creation if you created a group
  const listedGroups = await alixClient.conversations.listGroups()
  await delayToPropogate()
  groups.push(listedGroups[listedGroups.length - 1])
  if ((groups.length as number) !== 4) {
    throw Error('Expected group length 4 but it is: ' + groups.length)
  }

  alixClient.conversations.cancelStream()
  await delayToPropogate()

  // Creating a group should no longer trigger stream groups
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const caroSecond = await caroClient.conversations.newGroup([
    alixClient.inboxId,
  ])
  await delayToPropogate()
  if ((groups.length as number) !== 4) {
    throw Error('Unexpected num groups (should be 4): ' + groups.length)
  }

  return true
})

test('can filter groups by consent', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  const boGroup1 = await boClient.conversations.newGroup([alixClient.inboxId])
  const otherGroup = await alixClient.conversations.newGroup([boClient.inboxId])
  await boClient.conversations.findOrCreateDm(alixClient.inboxId)
  await caroClient.conversations.findOrCreateDm(boClient.inboxId)
  await boClient.conversations.sync()
  await boClient.conversations.findDmByInboxId(caroClient.inboxId)
  const boGroup2 = await boClient.conversations.findGroup(otherGroup.id)

  const boConvos = await boClient.conversations.listGroups()
  const boConvosFilteredAllowed = await boClient.conversations.listGroups(
    {},
    undefined,
    ['allowed']
  )
  const boConvosFilteredUnknown = await boClient.conversations.listGroups(
    {},
    undefined,
    ['unknown']
  )

  assert(
    boConvos.length === 2,
    `Conversation length should be 2 but was ${boConvos.length}`
  )

  assert(
    boConvosFilteredAllowed
      .map((conversation: any) => conversation.id)
      .toString() === [boGroup1.id].toString(),
    `Conversation allowed should be ${[
      boGroup1.id,
    ].toString()} but was ${boConvosFilteredAllowed
      .map((convo: any) => convo.id)
      .toString()}`
  )

  assert(
    boConvosFilteredUnknown
      .map((conversation: any) => conversation.id)
      .toString() === [boGroup2?.id].toString(),
    `Conversation unknown filter should be ${[
      boGroup2?.id,
    ].toString()} but was ${boConvosFilteredUnknown
      .map((convo: any) => convo.id)
      .toString()}`
  )

  return true
})

test('can list groups with params', async () => {
  const [alixClient, boClient] = await createClients(2)

  const boGroup1 = await boClient.conversations.newGroup([alixClient.inboxId])
  const boGroup2 = await boClient.conversations.newGroup([alixClient.inboxId])

  await boGroup1.send({ text: `first message` })
  await boGroup1.send({ text: `second message` })
  await boGroup1.send({ text: `third message` })
  await boGroup2.send({ text: `first message` })

  const boGroupsOrderLastMessage = await boClient.conversations.listGroups({
    lastMessage: true,
  })
  const boGroupsLimit = await boClient.conversations.listGroups({}, 1)

  assert(
    boGroupsOrderLastMessage.map((group: any) => group.id).toString() ===
      [boGroup2.id, boGroup1.id].toString(),
    `Group order should be group2 then group1 but was ${boGroupsOrderLastMessage
      .map((group: any) => group.id)
      .toString()}`
  )

  const messages = await boGroupsOrderLastMessage[0].messages()
  assert(
    messages[0].content() === 'first message',
    `last message should be first message ${messages[0].content()}`
  )
  assert(
    boGroupsOrderLastMessage[0].lastMessage?.content() === 'first message',
    `last message should be last message ${boGroupsOrderLastMessage[0].lastMessage?.content()}`
  )
  assert(
    boGroupsLimit.length === 1,
    `List length should be 1 but was ${boGroupsLimit.length}`
  )

  return true
})

test('can list groups', async () => {
  const [alixClient, boClient] = await createClients(2)

  const group1 = await boClient.conversations.newGroup([alixClient.inboxId], {
    name: 'group1 name',
    imageUrl: 'www.group1image.com',
  })
  const group2 = await boClient.conversations.newGroup([alixClient.inboxId], {
    name: 'group2 name',
    imageUrl: 'www.group2image.com',
  })

  const boGroups = await boClient.conversations.listGroups()
  await alixClient.conversations.sync()
  const alixGroups = await alixClient.conversations.listGroups()

  assert(
    boGroups.length === alixGroups.length,
    `group lengths should be the same but bo was ${boGroups.length} and alix was ${alixGroups.length}`
  )

  const boGroup1 = await boClient.conversations.findGroup(group1.id)
  const boGroup2 = await boClient.conversations.findGroup(group2.id)

  const alixGroup1 = await alixClient.conversations.findGroup(group1.id)
  const alixGroup2 = await alixClient.conversations.findGroup(group2.id)

  assert(
    boGroup2?.groupName === 'group2 name',
    `Group 2 name for bo should be group2 name but was ${boGroup2?.name}`
  )

  assert(
    boGroup1?.groupImageUrl === 'www.group1image.com',
    `Group 2 url for bo should be www.group1image.com but was ${boGroup1?.imageUrl}`
  )

  assert(
    alixGroup1?.groupName === 'group1 name',
    `Group 1 name for alix should be group1 name but was ${alixGroup1?.name}`
  )

  assert(
    alixGroup2?.groupImageUrl === 'www.group2image.com',
    `Group 2 url for alix should be www.group2image.com but was ${alixGroup2?.imageUrl}`
  )

  assert(boGroup1?.isGroupActive === true, `Group 1 should be active for bo`)

  return true
})

test('can stream groups and messages', async () => {
  const [alixClient, boClient] = await createClients(2)

  // Start streaming groups
  const groups: Conversation<any>[] = []
  await alixClient.conversations.stream(async (group: Conversation<any>) => {
    groups.push(group)
  })
  // Stream messages twice
  await alixClient.conversations.streamAllMessages(async (message) => {})
  await alixClient.conversations.streamAllMessages(async (message) => {})

  // bo creates a group with alix so a stream callback is fired
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  await boClient.conversations.newGroup([alixClient.inboxId])
  await delayToPropogate()
  if ((groups.length as number) !== 1) {
    throw Error(`Unexpected num groups (should be 1): ${groups.length}`)
  }

  return true
})

test('canMessage', async () => {
  const [alix, caro] = await createClients(3)

  const canMessageV3 = await caro.canMessage([
    caro.publicIdentity,
    alix.publicIdentity,
    new PublicIdentity(
      '0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67',
      'ETHEREUM'
    ),
  ])

  assert(
    canMessageV3['0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67'.toLowerCase()] ===
      false,
    `should not be able to message 0x4E9ce36E442e55EcD9025B9a6E0D88485d628A67`
  )

  assert(
    canMessageV3[caro.publicIdentity.identifier.toLowerCase()] === true,
    `should be able to message ${caro.publicIdentity.identifier}`
  )

  assert(
    canMessageV3[alix.publicIdentity.identifier.toLowerCase()] === true,
    `should be able to message ${alix.publicIdentity.identifier}`
  )

  return true
})

test('can stream group messages', async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient, caroClient] = await createClients(3)

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([
    boClient.inboxId,
    caroClient.inboxId,
  ])

  // Record message stream for this group
  const groupMessages: DecodedMessage[] = []
  const cancelGroupMessageStream = await alixGroup.streamMessages(
    async (message) => {
      groupMessages.push(message)
    }
  )

  // bo's num groups == 1
  await boClient.conversations.sync()
  const boGroup = (await boClient.conversations.listGroups())[0]

  for (let i = 0; i < 5; i++) {
    await boGroup.send({ text: `Message ${i}` })
    await delayToPropogate()
  }

  if (groupMessages.length !== 5) {
    throw Error('Unexpected convo messages count ' + groupMessages.length)
  }
  for (let i = 0; i < 5; i++) {
    if (groupMessages[i].content() !== `Message ${i}`) {
      throw Error(
        'Unexpected group message content ' + groupMessages[i].content()
      )
    }
  }

  cancelGroupMessageStream()
  for (let i = 0; i < 5; i++) {
    await boGroup.send({ text: `Message ${i}` })
  }

  if (groupMessages.length !== 5) {
    throw Error('Unexpected convo messages count ' + groupMessages.length)
  }

  return true
})

test('can make a group with metadata', async () => {
  const [alix, bo] = await createClients(2)
  Client.register(new GroupUpdatedCodec())

  const alixGroup = await alix.conversations.newGroup([bo.inboxId], {
    name: 'Start Name',
    imageUrl: 'starturl.com',
    description: 'a fun description',
  })

  const groupName1 = await alixGroup.name()
  const groupImageUrl1 = await alixGroup.imageUrl()
  const groupDescription1 = await alixGroup.description()
  assert(
    groupName1 === 'Start Name',
    `the group should start with a name of Start Name not ${groupName1}`
  )

  assert(
    groupImageUrl1 === 'starturl.com',
    `the group should start with a name of starturl.com not ${groupImageUrl1}`
  )

  assert(
    groupDescription1 === 'a fun description',
    `the group should start with a name of a fun description not ${groupDescription1}`
  )

  await alixGroup.updateName('New Name')
  await alixGroup.updateImageUrl('newurl.com')
  await alixGroup.updateDescription('a new group description')
  await alixGroup.sync()
  await bo.conversations.sync()
  const boGroups = await bo.conversations.listGroups()
  const boGroup = boGroups[0]
  await boGroup.sync()

  const groupName2 = await alixGroup.name()
  const groupImageUrl2 = await alixGroup.imageUrl()
  const groupDescription2 = await alixGroup.description()
  assert(
    groupName2 === 'New Name',
    `the group should start with a name of New Name not ${groupName2}`
  )

  assert(
    groupImageUrl2 === 'newurl.com',
    `the group should start with a name of newurl.com not ${groupImageUrl2}`
  )

  assert(
    groupDescription2 === 'a new group description',
    `the group should start with a name of a new group description not ${groupDescription2}`
  )

  const groupName3 = await boGroup.name()
  const groupImageUrl3 = await boGroup.imageUrl()
  assert(
    groupName3 === 'New Name',
    `the group should start with a name of New Name not ${groupName3}`
  )

  assert(
    groupImageUrl3 === 'newurl.com',
    `the group should start with a name of newurl.com not ${groupImageUrl3}`
  )

  const boMessages = await boGroup.messages()
  assert(
    boMessages[0].contentTypeId === 'xmtp.org/group_updated:1.0',
    'Unexpected message content ' + JSON.stringify(boMessages[0].contentTypeId)
  )

  const message = boMessages[1].content() as GroupUpdatedContent
  assert(
    message.metadataFieldsChanged[0].fieldName === 'group_image_url_square',
    `the metadata field changed should be group_image_url_square but was ${message.metadataFieldsChanged[0].fieldName}`
  )
  const message2 = boMessages[0].content() as GroupUpdatedContent
  assert(
    message2.metadataFieldsChanged[0].fieldName === 'description',
    `the metadata field changed should be description but was ${message2.metadataFieldsChanged[0].fieldName}`
  )
  return true
})

test('can make a group with admin permissions', async () => {
  const [adminClient, anotherClient] = await createClients(2)

  const group = await adminClient.conversations.newGroup(
    [anotherClient.inboxId],
    { permissionLevel: 'admin_only' }
  )

  if ((await group.permissionPolicySet()).addMemberPolicy !== 'admin') {
    throw Error(
      `Group permission level should be admin but was ${
        (await group.permissionPolicySet()).addMemberPolicy
      }`
    )
  }

  const isSuperAdmin = await group.isSuperAdmin(adminClient.inboxId)
  if (!isSuperAdmin) {
    throw Error(`adminClient should be the super admin`)
  }

  // Creator id not working, see https://github.com/xmtp/libxmtp/issues/788
  // if (group.creatorInboxId !== adminClient.inboxId) {
  //   throw Error(
  //     `adminClient should be the creator but was ${group.creatorInboxId}`
  //   )
  // }

  return true
})

test('can paginate group messages', async () => {
  // Create three MLS enabled Clients
  const [alixClient, boClient] = await createClients(2)

  // alix creates a group
  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])

  // alix can send messages
  await alixGroup.send('hello, world')
  await alixGroup.send('gm')

  await boClient.conversations.sync()
  const boGroups = await boClient.conversations.listGroups()
  if (boGroups.length !== 1) {
    throw new Error(
      'num groups for bo should be 1, but it is' + boGroups.length
    )
  }
  await delayToPropogate()
  // bo can read messages from alix
  await boGroups[0].sync()
  const boMessages: DecodedMessage[] = await boGroups[0].messages({
    limit: 1,
  })

  if (boMessages.length !== 1) {
    throw Error(`Should limit just 1 message but was ${boMessages.length}`)
  }

  return true
})

test('can stream all group messages', async () => {
  const [alix, bo, caro] = await createClients(3)

  await delayToPropogate()

  // Start bo starts a new group.
  const boGroup = await bo.conversations.newGroup([alix.inboxId])
  await delayToPropogate()

  // Starts a new conversation.
  const caroGroup = await caro.conversations.newGroup([alix.inboxId])

  // Record message stream across all conversations
  const allMessages: DecodedMessage[] = []
  // If we don't call syncConversations here, the streamAllGroupMessages will not
  // stream the first message. Feels like a bug.
  await alix.conversations.sync()
  await alix.conversations.streamAllMessages(async (message) => {
    allMessages.push(message)
  }, 'groups')
  await delayToPropogate()

  for (let i = 0; i < 5; i++) {
    await boGroup.send({ text: `Message ${i}` })
    await delayToPropogate()
  }

  const count = allMessages.length
  if (count !== 5) {
    throw Error('Unexpected all messages count first' + allMessages.length)
  }

  await delayToPropogate()
  for (let i = 0; i < 5; i++) {
    await caroGroup.send({ text: `Message ${i}` })
    await delayToPropogate()
  }

  if (allMessages.length !== 10) {
    throw Error('Unexpected all messages count second' + allMessages.length)
  }

  alix.conversations.cancelStreamAllMessages()
  await delayToPropogate()
  await alix.conversations.streamAllMessages(async (message) => {
    allMessages.push(message)
  })

  for (let i = 0; i < 5; i++) {
    await boGroup.send({ text: `Message ${i}` })
    await delayToPropogate()
  }
  if (allMessages.length <= 10) {
    throw Error('Unexpected all messages count ' + allMessages.length)
  }

  return true
})

test('creating a group should allow group', async () => {
  const [alix, bo] = await createClients(2)

  const group = await alix.conversations.newGroup([bo.inboxId])
  await alix.conversations.sync()
  const consent = await alix.preferences.conversationConsentState(group.id)
  const groupConsent = await group.consentState()

  if (consent !== groupConsent) {
    throw Error('Group should be allowed')
  }

  assert(
    groupConsent === 'allowed',
    `the message should have a consent state of allowed but was ${groupConsent}`
  )

  return true
})

test('can group consent', async () => {
  const [alix, bo] = await createClients(2)
  const group = await bo.conversations.newGroup([alix.inboxId])
  await alix.conversations.sync()
  let isAllowed = await alix.preferences.conversationConsentState(group.id)
  assert(
    isAllowed !== 'allowed',
    `alix group should NOT be allowed but was ${isAllowed}`
  )

  isAllowed = await bo.preferences.conversationConsentState(group.id)
  assert(
    isAllowed === 'allowed',
    `bo group should be allowed but was ${isAllowed}`
  )
  assert(
    (await group.state) === 'allowed',
    `the group should have a consent state of allowed but was ${await group.state}`
  )

  await bo.preferences.setConsentState(
    new ConsentRecord(group.id, 'conversation_id', 'denied')
  )
  const isDenied = await bo.preferences.conversationConsentState(group.id)
  assert(isDenied === 'denied', `bo group should be denied but was ${isDenied}`)
  assert(
    (await group.consentState()) === 'denied',
    `the group should have a consent state of denied but was ${await group.consentState()}`
  )

  await group.updateConsent('allowed')
  isAllowed = await bo.preferences.conversationConsentState(group.id)
  assert(
    isAllowed === 'allowed',
    `bo group should be allowed2 but was ${isAllowed}`
  )
  assert(
    (await group.consentState()) === 'allowed',
    `the group should have a consent state2 of allowed but was ${await group.consentState()}`
  )

  return true
})

test('can allow and deny a inbox id', async () => {
  const [alix, bo] = await createClients(2)
  const boGroup = await bo.conversations.newGroup([alix.inboxId])

  let isInboxAllowed = await bo.preferences.inboxIdConsentState(alix.inboxId)
  assert(
    isInboxAllowed === 'unknown',
    `isInboxAllowed should be unknown but was ${isInboxAllowed}`
  )

  await bo.preferences.setConsentState(
    new ConsentRecord(alix.inboxId, 'inbox_id', 'allowed')
  )

  let alixMember = (await boGroup.members()).find(
    (member) => member.inboxId === alix.inboxId
  )
  assert(
    alixMember?.consentState === 'allowed',
    `alixMember should be allowed but was ${alixMember?.consentState}`
  )

  isInboxAllowed = await bo.preferences.inboxIdConsentState(alix.inboxId)
  assert(
    isInboxAllowed === 'allowed',
    `isInboxAllowed2 should be true but was ${isInboxAllowed}`
  )

  await bo.preferences.setConsentState(
    new ConsentRecord(alix.inboxId, 'inbox_id', 'denied')
  )

  alixMember = (await boGroup.members()).find(
    (member) => member.inboxId === alix.inboxId
  )
  assert(
    alixMember?.consentState === 'denied',
    `alixMember should be denied but was ${alixMember?.consentState}`
  )

  isInboxAllowed = await bo.preferences.inboxIdConsentState(alix.inboxId)
  assert(
    isInboxAllowed === 'denied',
    `isInboxAllowed3 should be false but was ${isInboxAllowed}`
  )

  return true
})

test('sync function behaves as expected', async () => {
  const [alix, bo, caro] = await createClients(3)
  const alixGroup = await alix.conversations.newGroup([bo.inboxId])

  await alixGroup.send({ text: 'hello' })

  // List groups will return empty until the first sync
  let boGroups = await bo.conversations.listGroups()
  assert(boGroups.length === 0, 'num groups for bo is 0 until we sync')

  await bo.conversations.sync()

  boGroups = await bo.conversations.listGroups()
  assert(boGroups.length === 1, 'num groups for bo is 1')

  // Num members will include the initial num of members even before sync
  let numMembers = (await boGroups[0].memberInboxIds()).length
  assert(numMembers === 2, 'num members should be 2')

  // Num messages for a group will be 0 until we sync the group
  let numMessages = (await boGroups[0].messages()).length
  assert(numMessages === 0, 'num members should be 1')

  await bo.conversations.sync()

  // Num messages is still 0 because we didnt sync the group itself
  numMessages = (await boGroups[0].messages()).length
  assert(numMessages === 0, 'num messages should be 0')

  await boGroups[0].sync()

  // after syncing the group we now see the correct number of messages
  numMessages = (await boGroups[0].messages()).length
  assert(numMessages === 1, 'num members should be 1')

  await alixGroup.addMembers([caro.inboxId])

  numMembers = (await boGroups[0].memberInboxIds()).length
  assert(numMembers === 2, 'num members should be 2')

  await bo.conversations.sync()

  // Even though we synced the groups, we need to sync the group itself to see the new member
  numMembers = (await boGroups[0].memberInboxIds()).length
  assert(numMembers === 2, 'num members should be 2')

  await boGroups[0].sync()

  numMembers = (await boGroups[0].memberInboxIds()).length
  assert(numMembers === 3, 'num members should be 3')

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _alixGroup2 = await alix.conversations.newGroup([
    bo.inboxId,
    caro.inboxId,
  ])
  await bo.conversations.sync()
  boGroups = await bo.conversations.listGroups()
  assert(boGroups.length === 2, 'num groups for bo is 2')

  // Even before syncing the group, sync will return the initial number of members
  numMembers = (await boGroups[1].memberInboxIds()).length
  assert(numMembers === 3, 'num members should be 3')

  return true
})

test('can read and update group name', async () => {
  const [alix, bo, caro] = await createClients(3)
  const alixGroup = await alix.conversations.newGroup([bo.inboxId])

  await alixGroup.sync()
  let groupName = await alixGroup.name()

  assert(groupName === '', 'group name should be empty string')

  await alixGroup.updateName('Test name update 1')

  await alixGroup.sync()
  groupName = await alixGroup.name()

  assert(
    groupName === 'Test name update 1',
    'group name should be "Test name update 1"'
  )

  await bo.conversations.sync()
  const boGroup = (await bo.conversations.listGroups())[0]
  groupName = await boGroup.name()

  assert(groupName === '', 'group name should be empty string')

  await boGroup.sync()

  groupName = await boGroup.name()

  assert(
    groupName === 'Test name update 1',
    'group name should be "Test name update 1"'
  )

  await alixGroup.addMembers([caro.inboxId])
  await caro.conversations.sync()
  const caroGroup = (await caro.conversations.listGroups())[0]

  await caroGroup.sync()
  groupName = await caroGroup.name()
  assert(
    groupName === 'Test name update 1',
    'group name should be "Test name update 1"'
  )
  return true
})

test('can list groups does not fork', async () => {
  const [alix, bo] = await createClients(2)
  console.log('created clients')
  let groupCallbacks = 0
  //#region Stream groups
  await bo.conversations.stream(async () => {
    console.log('group received')
    groupCallbacks++
  })
  //#region Stream All Messages
  await bo.conversations.streamAllMessages(async () => {
    console.log('message received')
  })
  //#endregion
  // #region create group
  const alixGroup = await alix.conversations.newGroup([bo.inboxId])
  await alixGroup.updateName('hello')
  await alixGroup.send('hello1')
  console.log('sent group message')
  // #endregion
  // #region sync groups
  await bo.conversations.sync()
  // #endregion
  const boGroups = await bo.conversations.listGroups()
  assert(boGroups.length === 1, 'bo should have 1 group')
  const boGroup = boGroups[0]
  await boGroup.sync()

  const boMessages1 = await boGroup.messages()
  assert(
    boMessages1.length === 2,
    `should have 2 messages on first load received ${boMessages1.length}`
  )
  await boGroup.send('hello2')
  await boGroup.send('hello3')
  await alixGroup.sync()
  const alixMessages = await alixGroup.messages()
  for (const message of alixMessages) {
    console.log(
      'message',
      message.contentTypeId,
      message.contentTypeId === 'xmtp.org/text:1.0'
        ? message.content()
        : 'Group Updated'
    )
  }
  // alix sees 3 messages
  assert(
    alixMessages.length === 5,
    `should have 5 messages on first load received ${alixMessages.length}`
  )
  await alixGroup.send('hello4')
  await boGroup.sync()
  const boMessages2 = await boGroup.messages()
  for (const message of boMessages2) {
    console.log(
      'message',
      message.contentTypeId,
      message.contentTypeId === 'xmtp.org/text:1.0'
        ? message.content()
        : 'Group Updated'
    )
  }
  // bo sees 4 messages
  assert(
    boMessages2.length === 5,
    `should have 5 messages on second load received ${boMessages2.length}`
  )

  await delayToPropogate(500)

  assert(groupCallbacks === 1, 'group stream should have received 1 group')

  return true
})

test('can list many groups members in parallel', async () => {
  const [alix, bo] = await createClients(2)
  const groups: Group[] = await createGroups(alix, [bo], 20)

  try {
    await Promise.all(groups.slice(0, 10).map((g) => g.members()))
  } catch (e) {
    throw new Error(`Failed listing 10 groups members with ${e}`)
  }

  try {
    await Promise.all(groups.slice(0, 20).map((g) => g.members()))
  } catch (e) {
    throw new Error(`Failed listing 20 groups members with ${e}`)
  }

  return true
})

test('can sync all groups', async () => {
  const [alix, bo] = await createClients(2)
  const groups: Group[] = await createGroups(alix, [bo], 50)

  const alixGroup = groups[0]
  await bo.conversations.sync()
  const boGroup = await bo.conversations.findGroup(alixGroup.id)
  await alixGroup.send('hi')
  assert(
    (await boGroup?.messages())?.length === 0,
    `messages should be empty before sync but was ${boGroup?.messages?.length}`
  )

  const numGroupsSynced = await bo.conversations.syncAllConversations()
  assert(
    (await boGroup?.messages())?.length === 1,
    `messages should be 4 after sync but was ${boGroup?.messages?.length}`
  )
  assert(
    numGroupsSynced === 51,
    `should have synced 51 groups but synced ${numGroupsSynced}`
  )

  for (const group of groups) {
    await group.removeMembers([bo.inboxId])
  }

  // First syncAllConversations after removal will still sync each group to set group inactive
  const numGroupsSynced2 = await bo.conversations.syncAllConversations()
  assert(
    numGroupsSynced2 === 51,
    `should have synced 51 groups but synced ${numGroupsSynced2}`
  )

  // Next syncAllConversations will not sync inactive groups
  const numGroupsSynced3 = await bo.conversations.syncAllConversations()
  assert(
    numGroupsSynced3 === 1,
    `should have synced 1 groups but synced ${numGroupsSynced3}`
  )
  return true
})

test('only streams groups that can be decrypted', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)
  const alixGroups: Conversation<any>[] = []
  const boGroups: Conversation<any>[] = []
  const caroGroups: Conversation<any>[] = []

  await alixClient.conversations.stream(async (group: Conversation<any>) => {
    alixGroups.push(group)
  })
  await boClient.conversations.stream(async (group: Conversation<any>) => {
    boGroups.push(group)
  })
  await caroClient.conversations.stream(async (group: Conversation<any>) => {
    caroGroups.push(group)
  })

  await alixClient.conversations.newGroup([boClient.inboxId])
  await delayToPropogate()
  assert(
    alixGroups.length === 1,
    `alix group length should be 1 but was ${alixGroups.length}`
  )

  assert(
    boGroups.length === 1,
    `bo group length should be 1 but was ${boGroups.length}`
  )

  assert(
    caroGroups.length !== 1,
    `caro group length should be 0 but was ${caroGroups.length}`
  )

  return true
})

test('can stream groups and messages', async () => {
  for (let index = 0; index < 15; index++) {
    console.log(`stream groups & messages: test ${index}`)
    const [alixClient, boClient] = await createClients(2)

    // Start streaming groups
    const groups: Conversation<any>[] = []
    await alixClient.conversations.stream(async (group: Conversation<any>) => {
      groups.push(group)
    })
    // Stream messages twice
    await alixClient.conversations.streamAllMessages(async (message) => {})
    await alixClient.conversations.streamAllMessages(async (message) => {})

    // bo creates a group with alix so a stream callback is fired
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    await boClient.conversations.newGroup([alixClient.inboxId])
    await delayToPropogate(500)
    if ((groups.length as number) !== 1) {
      throw Error(`Unexpected num groups (should be 1): ${groups.length}`)
    }
  }

  return true
})

test('can create new installation without breaking group', async () => {
  const keyBytes = new Uint8Array([
    233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125, 64,
    166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252, 135, 145,
  ])
  const wallet1 = Wallet.createRandom()
  const wallet2 = Wallet.createRandom()

  const client1 = await Client.create(adaptEthersWalletToSigner(wallet1), {
    env: 'local',
    dbEncryptionKey: keyBytes,
  })
  const client2 = await Client.create(adaptEthersWalletToSigner(wallet2), {
    env: 'local',
    dbEncryptionKey: keyBytes,
  })

  const group = await client1.conversations.newGroup([client2.inboxId])

  await client1.conversations.sync()
  await client2.conversations.sync()

  const client1Group = await client1.conversations.findGroup(group.id)
  const client2Group = await client2.conversations.findGroup(group.id)

  await client1Group?.sync()
  await client2Group?.sync()

  const members1 = await client1Group?.members()
  assert(
    members1?.length === 2,
    `client 1 should see 2 members but was ${members1?.length}`
  )

  const members2 = await client2Group?.members()
  assert(
    members2?.length === 2,
    `client 2 should see 2 members but was ${members2?.length}`
  )

  await client2.deleteLocalDatabase()

  // Recreating a client with wallet 2 (new installation!)
  await Client.create(adaptEthersWalletToSigner(wallet2), {
    env: 'local',
    dbEncryptionKey: keyBytes,
  })

  await client1Group?.send('This message will break the group')
  const members3 = await client1Group?.members()
  assert(
    members3?.length === 2,
    `client 1 should still see the 2 members but was ${members3?.length}`
  )

  return true
})

test('handles disappearing messages in a group', async () => {
  const [alixClient, boClient] = await createClients(2)

  const initialSettings = {
    disappearStartingAtNs: 1_000_000_000,
    retentionDurationInNs: 1_000_000_000, // 1s duration
  }

  const customPermissionsPolicySet: PermissionPolicySet = {
    addMemberPolicy: 'allow',
    removeMemberPolicy: 'deny',
    addAdminPolicy: 'admin',
    removeAdminPolicy: 'superAdmin',
    updateGroupNamePolicy: 'admin',
    updateGroupDescriptionPolicy: 'allow',
    updateGroupImagePolicy: 'admin',
    updateMessageDisappearingPolicy: 'deny',
  }

  // Create group with disappearing messages enabled
  const boGroup = await boClient.conversations.newGroup([alixClient.inboxId], {
    disappearingMessageSettings: initialSettings,
  })
  await boClient.conversations.newGroupWithIdentities(
    [alixClient.publicIdentity],
    {
      disappearingMessageSettings: initialSettings,
    }
  )
  await boClient.conversations.newGroupCustomPermissions(
    [alixClient.inboxId],
    customPermissionsPolicySet,
    {
      disappearingMessageSettings: initialSettings,
    }
  )
  await boClient.conversations.newGroupCustomPermissionsWithIdentities(
    [alixClient.publicIdentity],
    customPermissionsPolicySet,
    {
      disappearingMessageSettings: initialSettings,
    }
  )

  await boGroup.send('howdy')
  await alixClient.conversations.syncAllConversations()

  const alixGroup = await alixClient.conversations.findGroup(boGroup.id)

  // Validate initial state
  await assertEqual(
    () => boGroup.messages().then((m) => m.length),
    2,
    'BoGroup should have 2 messages'
  )
  await assertEqual(
    () => alixGroup!.messages().then((m) => m.length),
    1,
    'AlixGroup should have 1 message'
  )
  await assertEqual(
    () => boGroup.disappearingMessageSettings() !== undefined,
    true,
    'BoGroup should have disappearing settings'
  )
  await assertEqual(
    () =>
      boGroup
        .disappearingMessageSettings()
        .then((s) => s!.retentionDurationInNs),
    1_000_000_000,
    'Retention duration should be 1s'
  )
  await assertEqual(
    () =>
      boGroup
        .disappearingMessageSettings()
        .then((s) => s!.disappearStartingAtNs),
    1_000_000_000,
    'Disappearing should start at 1s'
  )

  // Wait for messages to disappear
  await delayToPropogate(5000)

  // Validate messages are deleted
  await assertEqual(
    () => boGroup.messages().then((m) => m.length),
    1,
    'BoGroup should have 1 remaining message'
  )
  await assertEqual(
    () => alixGroup!.messages().then((m) => m.length),
    0,
    'AlixGroup should have 0 messages left'
  )

  // Disable disappearing messages
  await boGroup.clearDisappearingMessageSettings()
  await delayToPropogate(1000)

  await boGroup.sync()
  await alixGroup!.sync()

  await delayToPropogate(1000)

  // Validate disappearing messages are disabled
  await assertEqual(
    () => boGroup.disappearingMessageSettings(),
    undefined,
    'BoGroup should not have disappearing settings'
  )
  await assertEqual(
    () => alixGroup!.disappearingMessageSettings(),
    undefined,
    'AlixGroup should not have disappearing settings'
  )

  await assertEqual(
    () => boGroup.isDisappearingMessagesEnabled(),
    false,
    'BoGroup should have disappearing disabled'
  )
  await assertEqual(
    () => alixGroup!.isDisappearingMessagesEnabled(),
    false,
    'AlixGroup should have disappearing disabled'
  )

  // Send messages after disabling disappearing settings
  await boGroup.send('message after disabling disappearing')
  await alixGroup!.send('another message after disabling')
  await boGroup.sync()

  await delayToPropogate(1000)

  // Ensure messages persist
  await assertEqual(
    () => boGroup.messages().then((m) => m.length),
    5,
    'BoGroup should have 5 messages'
  )
  await assertEqual(
    () => alixGroup!.messages().then((m) => m.length),
    4,
    'AlixGroup should have 4 messages'
  )

  // Re-enable disappearing messages
  const updatedSettings = {
    disappearStartingAtNs: (await boGroup.messages())[0].sentNs + 1_000_000_000, // 1s from now
    retentionDurationInNs: 1_000_000_000,
  }
  await boGroup.updateDisappearingMessageSettings(updatedSettings)
  await delayToPropogate(1000)

  await boGroup.sync()
  await alixGroup!.sync()

  await delayToPropogate(1000)

  // Validate updated settings
  await assertEqual(
    () =>
      boGroup
        .disappearingMessageSettings()
        .then((s) => s!.disappearStartingAtNs),
    updatedSettings.disappearStartingAtNs,
    'BoGroup disappearStartingAtNs should match updated settings'
  )
  await assertEqual(
    () =>
      alixGroup!
        .disappearingMessageSettings()
        .then((s) => s!.disappearStartingAtNs),
    updatedSettings.disappearStartingAtNs,
    'AlixGroup disappearStartingAtNs should match updated settings'
  )

  // Send new messages
  await boGroup.send('this will disappear soon')
  await alixGroup!.send('so will this')
  await boGroup.sync()

  await assertEqual(
    () => boGroup.messages().then((m) => m.length),
    9,
    'BoGroup should have 9 messages'
  )
  await assertEqual(
    () => alixGroup!.messages().then((m) => m.length),
    8,
    'AlixGroup should have 8 messages'
  )

  await delayToPropogate(6000)

  // Validate messages were deleted
  await assertEqual(
    () => boGroup.messages().then((m) => m.length),
    7,
    'BoGroup should have 7 messages left'
  )
  await assertEqual(
    () => alixGroup!.messages().then((m) => m.length),
    6,
    'AlixGroup should have 6 messages left'
  )

  // Final validation that settings persist
  await assertEqual(
    () =>
      boGroup
        .disappearingMessageSettings()
        .then((s) => s!.retentionDurationInNs),
    updatedSettings.retentionDurationInNs,
    'BoGroup retentionDuration should match updated settings'
  )
  await assertEqual(
    () =>
      alixGroup!
        .disappearingMessageSettings()
        .then((s) => s!.retentionDurationInNs),
    updatedSettings.retentionDurationInNs,
    'AlixGroup retentionDuration should match updated settings'
  )
  await assertEqual(
    () => boGroup.isDisappearingMessagesEnabled(),
    true,
    'BoGroup should have disappearing enabled'
  )
  await assertEqual(
    () => alixGroup!.isDisappearingMessagesEnabled(),
    true,
    'AlixGroup should have disappearing enabled'
  )

  return true
})

// Commenting this out so it doesn't block people, but nice to have?
// test('can stream messages for a long time', async () => {
//   const bo = await Client.createRandom({ env: 'local', enableV3: true })
//   await delayToPropogate()
//   const alix = await Client.createRandom({ env: 'local', enableV3: true })
//   await delayToPropogate()
//   const caro = await Client.createRandom({ env: 'local', enableV3: true })
//   await delayToPropogate()

//   // Setup stream alls
//   const allBoMessages: any[] = []
//   const allAliMessages: any[] = []

//   const group = await caro.conversations.newGroup([alix.inboxId])
//   await bo.conversations.streamAllMessages(async (conversation) => {
//     allBoMessages.push(conversation)
//   }, true)
//   await alix.conversations.streamAllMessages(async (conversation) => {
//     allAliMessages.push(conversation)
//   }, true)

//   // Wait for 15 minutes
//   await delayToPropogate(15 * 1000 * 60)

//   // Start Caro starts a new conversation.
//   const convo = await caro.conversations.newConversation(alix.inboxId)
//   await group.send({ text: 'hello' })
//   await convo.send({ text: 'hello' })
//   await delayToPropogate()
//   if (allBoMessages.length !== 0) {
//     throw Error('Unexpected all conversations count ' + allBoMessages.length)
//   }
//   if (allAliMessages.length !== 2) {
//     throw Error('Unexpected all conversations count ' + allAliMessages.length)
//   }

//   return true
// })
