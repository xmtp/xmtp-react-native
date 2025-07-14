import {
  Test,
  assert,
  assertEqual,
  createClients,
  debugLog,
  delayToPropogate,
} from './test-utils'
import { Conversation } from '../../../src/index'

export const dmTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  dmTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('can filter dms by consent', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  await boClient.conversations.newGroup([alixClient.inboxId])
  const otherGroup = await alixClient.conversations.newGroup([boClient.inboxId])
  const boDm1 = await boClient.conversations.findOrCreateDm(alixClient.inboxId)
  await caroClient.conversations.findOrCreateDm(boClient.inboxId)
  await boClient.conversations.sync()
  const boDm2 = await boClient.conversations.findDmByInboxId(caroClient.inboxId)
  await boClient.conversations.findGroup(otherGroup.id)

  const boConvos = await boClient.conversations.listDms()
  const boConvosFilteredAllowed = await boClient.conversations.listDms(
    {},
    undefined,
    ['allowed']
  )
  const boConvosFilteredUnknown = await boClient.conversations.listDms(
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
      .toString() === [boDm1.id].toString(),
    `Conversation allowed should be ${[
      boDm1.id,
    ].toString()} but was ${boConvosFilteredAllowed
      .map((convo: any) => convo.id)
      .toString()}`
  )

  assert(
    boConvosFilteredUnknown
      .map((conversation: any) => conversation.id)
      .toString() === [boDm2?.id].toString(),
    `Conversation unknown filter should be ${[
      boDm2?.id,
    ].toString()} but was ${boConvosFilteredUnknown
      .map((convo: any) => convo.id)
      .toString()}`
  )

  return true
})

test('can list dms with params', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  const boGroup1 = await boClient.conversations.newGroup([alixClient.inboxId])
  const boGroup2 = await boClient.conversations.newGroup([alixClient.inboxId])
  const boDm1 = await boClient.conversations.findOrCreateDm(alixClient.inboxId)
  const boDm2 = await boClient.conversations.findOrCreateDm(caroClient.inboxId)

  await boGroup1.send({ text: `first message` })
  await boGroup1.send({ text: `second message` })
  await boGroup1.send({ text: `third message` })
  await boDm2.send({ text: `third message` })
  await boGroup2.send({ text: `first message` })
  await boDm1.send({ text: `dm message` })

  await boClient.conversations.syncAllConversations()
  const boConvosOrderLastMessage = await boClient.conversations.listDms({
    lastMessage: true,
  })
  const boDmsLimit = await boClient.conversations.listDms({}, 1)

  assert(
    boConvosOrderLastMessage
      .map((conversation: any) => conversation.id)
      .toString() === [boDm1.id, boDm2.id].toString(),
    `Conversation last message order should be ${[
      boDm1.id,
      boDm2.id,
    ].toString()} but was ${boConvosOrderLastMessage
      .map((convo: any) => convo.id)
      .toString()}`
  )

  const messages = await boConvosOrderLastMessage[0].messages()
  assert(
    messages[0].content() === 'dm message',
    `last message 1 should be dm message ${messages[0].content()}`
  )

  assert(
    boDmsLimit[0].id === boDm1.id,
    `Dms limit should be ${boDm1.id} but was ${boDmsLimit[0].id}`
  )

  return true
})

test('can stream all dm messages', async () => {
  const [alix, bo] = await createClients(2)

  let conversationCallbacks = 0
  let messageCallbacks = 0
  await bo.conversations.stream(async () => {
    conversationCallbacks++
  }, 'dms')

  await bo.conversations.streamAllMessages(async () => {
    messageCallbacks++
  }, 'dms')

  const group = await alix.conversations.newGroup([bo.inboxId])
  const dm = await alix.conversations.findOrCreateDm(bo.inboxId)
  await delayToPropogate()
  await group.send('hello')
  await dm.send('hello')
  await delayToPropogate()

  assert(
    conversationCallbacks === 1,
    'conversation stream should have received 1 conversation'
  )
  assert(
    messageCallbacks === 1,
    'message stream should have received 1 message'
  )

  return true
})

test('can stream dm messages', async () => {
  const [alixClient, boClient] = await createClients(2)

  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])
  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.inboxId)
  const alixConversation = await alixClient.conversations.findConversation(
    alixGroup.id
  )

  let dmMessageCallbacks = 0
  let conversationMessageCallbacks = 0
  await alixConversation?.streamMessages(async () => {
    conversationMessageCallbacks++
  })

  await alixDm.streamMessages(async () => {
    dmMessageCallbacks++
  })

  await alixConversation?.send({ text: `first message` })
  await alixDm.send({ text: `first message` })

  assert(
    conversationMessageCallbacks === 1,
    'conversation stream should have received 1 conversation'
  )
  assert(
    dmMessageCallbacks === 1,
    'message stream should have received 1 message'
  )

  return true
})

test('can stream all dms', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  const containers: Conversation<any>[] = []
  await alixClient.conversations.stream(
    async (conversation: Conversation<any>) => {
      containers.push(conversation)
    }
  )

  await delayToPropogate()
  await boClient.conversations.newGroup([alixClient.inboxId])
  await delayToPropogate()

  await assertEqual(
    containers.length,
    1,
    'Unexpected num conversations (should be 1): ' + containers.length
  )

  await boClient.conversations.findOrCreateDm(alixClient.inboxId)
  await delayToPropogate()
  await assertEqual(
    containers.length,
    2,
    'Unexpected num conversations (should be 2): ' + containers.length
  )

  await alixClient.conversations.findOrCreateDm(caroClient.inboxId)
  await delayToPropogate(500)
  await assertEqual(
    containers.length,
    3,
    'Expected conversations length 3 but it is: ' + containers.length
  )

  alixClient.conversations.cancelStream()
  await delayToPropogate()

  await caroClient.conversations.newGroup([alixClient.inboxId])
  await delayToPropogate()
  if ((containers.length as number) !== 3) {
    throw Error(
      'Unexpected num conversations (should be 3): ' + containers.length
    )
  }

  return true
})

test('handles disappearing messages in a dm', async () => {
  const [alixClient, boClient, caroClient] = await createClients(3)

  const initialSettings = {
    disappearStartingAtNs: 1_000_000_000,
    retentionDurationInNs: 1_000_000_000, // 1s duration
  }

  // Create group with disappearing messages enabled
  const boDm = await boClient.conversations.findOrCreateDm(
    alixClient.inboxId,
    initialSettings
  )

  await boClient.conversations.findOrCreateDmWithIdentity(
    caroClient.publicIdentity,
    initialSettings
  )

  await boDm.send('howdy')
  await alixClient.conversations.syncAllConversations()

  const alixDm = await alixClient.conversations.findDmByInboxId(
    boClient.inboxId
  )

  // Validate initial state
  await assertEqual(
    () => boDm.messages().then((m) => m.length),
    2,
    'boDm should have 2 messages'
  )
  await assertEqual(
    () => alixDm!.messages().then((m) => m.length),
    2,
    'alixDm should have 2 message'
  )
  await assertEqual(
    () => boDm.disappearingMessageSettings() !== undefined,
    true,
    'boDm should have disappearing settings'
  )
  await assertEqual(
    () =>
      boDm.disappearingMessageSettings().then((s) => s!.retentionDurationInNs),
    1_000_000_000,
    'Retention duration should be 1s'
  )
  await assertEqual(
    () =>
      boDm.disappearingMessageSettings().then((s) => s!.disappearStartingAtNs),
    1_000_000_000,
    'Disappearing should start at 1s'
  )

  debugLog('Validate initial state passes')

  // Wait for messages to disappear
  await delayToPropogate(5000)

  // Validate messages are deleted
  await assertEqual(
    () => boDm.messages().then((m) => m.length),
    1,
    'boDm should have 1 remaining message'
  )
  await assertEqual(
    () => alixDm!.messages().then((m) => m.length),
    1,
    'alixDm should have 1 messages left'
  )

  debugLog('Validate messages are deleted passes')

  // Disable disappearing messages
  await boDm.clearDisappearingMessageSettings()
  await delayToPropogate(1000)

  await boDm.sync()
  await alixDm!.sync()

  await delayToPropogate(1000)

  // Validate disappearing messages are disabled
  await assertEqual(
    () => boDm.disappearingMessageSettings(),
    undefined,
    'boDm should not have disappearing settings'
  )
  await assertEqual(
    () => alixDm!.disappearingMessageSettings(),
    undefined,
    'alixDm should not have disappearing settings'
  )

  await assertEqual(
    () => boDm.isDisappearingMessagesEnabled(),
    false,
    'boDm should have disappearing disabled'
  )
  await assertEqual(
    () => alixDm!.isDisappearingMessagesEnabled(),
    false,
    'alixDm should have disappearing disabled'
  )

  debugLog('Validate disappearing messages are disabled passes')

  // Send messages after disabling disappearing settings
  await boDm.send('message after disabling disappearing')
  await alixDm!.send('another message after disabling')
  await boDm.sync()

  await delayToPropogate(1000)

  // Ensure messages persist
  await assertEqual(
    () => boDm.messages().then((m) => m.length),
    3,
    'boDm should have 3 messages'
  )
  await assertEqual(
    () => alixDm!.messages().then((m) => m.length),
    3,
    'alixDm should have 3 messages'
  )

  debugLog('Ensure messages persist passes')

  // Re-enable disappearing messages
  const updatedSettings = {
    disappearStartingAtNs: (await boDm.messages())[0].sentNs + 1_000_000_000, // 1s from now
    retentionDurationInNs: 1_000_000_000,
  }
  await boDm.updateDisappearingMessageSettings(updatedSettings)
  await delayToPropogate(1000)

  await boDm.sync()
  await alixDm!.sync()

  await delayToPropogate(1000)

  // Validate updated settings
  await assertEqual(
    () =>
      boDm.disappearingMessageSettings().then((s) => s!.disappearStartingAtNs),
    updatedSettings.disappearStartingAtNs,
    'boDm disappearStartingAtNs should match updated settings'
  )
  await assertEqual(
    () =>
      alixDm!
        .disappearingMessageSettings()
        .then((s) => s!.disappearStartingAtNs),
    updatedSettings.disappearStartingAtNs,
    'alixDm disappearStartingAtNs should match updated settings'
  )

  debugLog('Validate updated settings passes')

  // Send new messages
  await boDm.send('this will disappear soon')
  await alixDm!.send('so will this')
  await boDm.sync()

  await assertEqual(
    () => boDm.messages().then((m) => m.length),
    5,
    'boDm should have 5 messages'
  )
  await assertEqual(
    () => alixDm!.messages().then((m) => m.length),
    5,
    'alixDm should have 5 messages'
  )

  await delayToPropogate(6000)

  // Validate messages were deleted
  await assertEqual(
    () => boDm.messages().then((m) => m.length),
    3,
    'boDm should have 7 messages left'
  )
  await assertEqual(
    () => alixDm!.messages().then((m) => m.length),
    3,
    'alixDm should have 7 messages left'
  )

  debugLog('Validate NEW messages were deleted passes')

  // Final validation that settings persist
  await assertEqual(
    () =>
      boDm.disappearingMessageSettings().then((s) => s!.retentionDurationInNs),
    updatedSettings.retentionDurationInNs,
    'boDm retentionDuration should match updated settings'
  )
  await assertEqual(
    () =>
      alixDm!
        .disappearingMessageSettings()
        .then((s) => s!.retentionDurationInNs),
    updatedSettings.retentionDurationInNs,
    'alixDm retentionDuration should match updated settings'
  )
  await assertEqual(
    () => boDm.isDisappearingMessagesEnabled(),
    true,
    'boDm should have disappearing enabled'
  )
  await assertEqual(
    () => alixDm!.isDisappearingMessagesEnabled(),
    true,
    'alixDm should have disappearing enabled'
  )

  debugLog('Validate final state passes')

  return true
})
