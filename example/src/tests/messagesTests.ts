import { type Group, type Dm } from 'xmtp-react-native-sdk'

import { Test, assert, createClients, delayToPropogate } from './test-utils'

export const messagesTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  messagesTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

const getNewestMessageTime = async (conversation: Group | Dm) => {
  const messages = await conversation.messages({ direction: 'DESCENDING' })
  return {
    sentAtNs: messages[0].sentNs,
    insertedAtNs: messages[0].insertedAtNs,
  }
}

test('can filter messages by afterNs and beforeNs', async () => {
  const [alixClient, boClient] = await createClients(2)

  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])

  // Send first message
  await alixGroup.send('message 1')
  await delayToPropogate(100)

  const { sentAtNs: message1SentNs } = await getNewestMessageTime(alixGroup)
  // Wait and send second message
  await delayToPropogate(100)
  await alixGroup.send('message 2')
  await delayToPropogate(100)

  // Get all messages again to capture the second message timestamp
  const { sentAtNs: message2SentNs } = await getNewestMessageTime(alixGroup)

  // Wait and send third message
  await delayToPropogate(100)
  await alixGroup.send('message 3')
  const { sentAtNs: message3SentNs } = await getNewestMessageTime(alixGroup)
  await delayToPropogate(100)

  // Test afterNs - should return messages sent after message1
  const messagesAfterMessage1 = await alixGroup.messages({
    afterNs: message1SentNs,
  })
  assert(
    messagesAfterMessage1.length === 2,
    `Expected 2 messages after message1, got ${messagesAfterMessage1.length}`
  )

  // Test beforeNs - should return messages sent before message2 (including group creation)
  const messagesBeforeMessage2 = await alixGroup.messages({
    beforeNs: message2SentNs,
  })
  assert(
    messagesBeforeMessage2.length === 2,
    `Expected 2 messages before message2 (message1 + group creation), got ${messagesBeforeMessage2.length}`
  )

  // Test both afterNs and beforeNs together - should return only message 2
  const messagesBetween = await alixGroup.messages({
    afterNs: message1SentNs,
    beforeNs: message3SentNs,
  })

  console.log(messagesBetween.length)

  // Find message 2 content
  const message2 = messagesBetween.find((m) => m.content() === 'message 2')
  assert(message2 !== undefined, 'Should find message 2 in the filtered range')

  return true
})

test('can filter messages by insertedAfterNs and insertedBeforeNs', async () => {
  const [alixClient, boClient] = await createClients(2)

  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])

  // Send messages with delays to ensure different insertedAtNs values
  await alixGroup.send('message 1')
  await delayToPropogate(100)

  const { insertedAtNs: message1InsertedNs } =
    await getNewestMessageTime(alixGroup)

  await delayToPropogate(100)
  await alixGroup.send('message 2')
  await delayToPropogate(100)

  const { insertedAtNs: message2InsertedNs } =
    await getNewestMessageTime(alixGroup)

  await delayToPropogate(100)
  await alixGroup.send('message 3')
  await delayToPropogate(100)

  // Test insertedAfterNs - should return messages inserted after message1
  const messagesInsertedAfterMessage1 = await alixGroup.messages({
    insertedAfterNs: message1InsertedNs,
  })
  assert(
    messagesInsertedAfterMessage1.length === 2,
    `Expected 2 messages inserted after message1, got ${messagesInsertedAfterMessage1.length}`
  )

  // Test insertedBeforeNs - should return messages inserted before message2
  const messagesInsertedBeforeMessage2 = await alixGroup.messages({
    insertedBeforeNs: message2InsertedNs,
  })
  assert(
    messagesInsertedBeforeMessage2.length === 2,
    `Expected 2 messages inserted before message2 (message1 + group creation), got ${messagesInsertedBeforeMessage2.length}`
  )

  return true
})

test('can combine sentNs and insertedNs filters', async () => {
  const [alixClient, boClient] = await createClients(2)

  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])

  // Send messages
  await alixGroup.send('message 1')
  await delayToPropogate(100)

  const { sentAtNs: message1SentNs, insertedAtNs: message1InsertedNs } =
    await getNewestMessageTime(alixGroup)

  await delayToPropogate(100)
  await alixGroup.send('message 2')
  await delayToPropogate(100)

  await alixGroup.send('message 3')
  await delayToPropogate(100)

  // Use afterNs to filter by sent time
  const messagesAfterSent = await alixGroup.messages({
    afterNs: message1SentNs,
  })

  assert(
    messagesAfterSent.length === 2,
    `Expected 2 messages after sentNs, got ${messagesAfterSent.length}`
  )

  // Use insertedAfterNs to filter by insertion time
  const messagesAfterInserted = await alixGroup.messages({
    insertedAfterNs: message1InsertedNs,
  })

  assert(
    messagesAfterInserted.length === 2,
    `Expected 2 messages after insertedNs, got ${messagesAfterInserted.length}`
  )

  return true
})

test('can filter dm messages by afterNs and beforeNs', async () => {
  const [alixClient, boClient] = await createClients(2)

  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.inboxId)

  // Send first message
  await alixDm.send('dm message 1')
  await delayToPropogate(100)

  const { sentAtNs: message1SentNs } = await getNewestMessageTime(alixDm)

  // Send second message
  await delayToPropogate(100)
  await alixDm.send('dm message 2')
  await delayToPropogate(100)

  const { sentAtNs: message2SentNs } = await getNewestMessageTime(alixDm)

  // Test afterNs - should return messages sent after message1
  const messagesAfterMessage1 = await alixDm.messages({
    afterNs: message1SentNs,
  })
  assert(
    messagesAfterMessage1.length === 1,
    `Expected 1 message after message1, got ${messagesAfterMessage1.length}`
  )
  assert(
    messagesAfterMessage1[0].content() === 'dm message 2',
    `Expected 'dm message 2', got '${messagesAfterMessage1[0].content()}'`
  )

  // Test beforeNs - should return messages sent before message2 (message1 + dm creation)
  const messagesBeforeMessage2 = await alixDm.messages({
    beforeNs: message2SentNs,
  })
  assert(
    messagesBeforeMessage2.length === 2,
    `Expected 2 messages before message2 (message1 + dm creation), got ${messagesBeforeMessage2.length}`
  )

  return true
})

test('can filter dm messages by insertedAfterNs and insertedBeforeNs', async () => {
  const [alixClient, boClient] = await createClients(2)

  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.inboxId)

  // Send first message
  await alixDm.send('dm message 1')
  await delayToPropogate(100)

  const { insertedAtNs: message1InsertedNs } =
    await getNewestMessageTime(alixDm)

  // Send second message
  await delayToPropogate(100)
  await alixDm.send('dm message 2')
  await delayToPropogate(100)

  const { insertedAtNs: message2InsertedNs } =
    await getNewestMessageTime(alixDm)

  // Test insertedAfterNs - should return messages inserted after message1
  const messagesInsertedAfterMessage1 = await alixDm.messages({
    insertedAfterNs: message1InsertedNs,
  })
  assert(
    messagesInsertedAfterMessage1.length === 1,
    `Expected 1 message inserted after message1, got ${messagesInsertedAfterMessage1.length}`
  )
  assert(
    messagesInsertedAfterMessage1[0].content() === 'dm message 2',
    `Expected 'dm message 2', got '${messagesInsertedAfterMessage1[0].content()}'`
  )

  // Test insertedBeforeNs - should return messages inserted before message2
  const messagesInsertedBeforeMessage2 = await alixDm.messages({
    insertedBeforeNs: message2InsertedNs,
  })
  assert(
    messagesInsertedBeforeMessage2.length === 2,
    `Expected 2 messages inserted before message2 (message1 + dm creation), got ${messagesInsertedBeforeMessage2.length}`
  )

  return true
})
