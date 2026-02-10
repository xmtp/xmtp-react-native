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

test('can sort messages by sortBy parameter', async () => {
  const [alixClient, boClient] = await createClients(2)

  const alixGroup = await alixClient.conversations.newGroup([boClient.inboxId])

  // Send messages with delays to ensure different timestamps
  await alixGroup.send('message 1')
  await delayToPropogate(100)
  await alixGroup.send('message 2')
  await delayToPropogate(100)
  await alixGroup.send('message 3')
  await delayToPropogate(100)

  // Fetch messages sorted by SENT_TIME ascending
  const messagesBySentAsc = await alixGroup.messages({
    direction: 'ASCENDING',
    sortBy: 'SENT_TIME',
  })
  // Filter to only text messages (exclude group creation membership change)
  const textMessagesBySentAsc = messagesBySentAsc.filter(
    (m) =>
      typeof m.content() === 'string' &&
      (m.content() as string).startsWith('message')
  )
  assert(
    textMessagesBySentAsc.length === 3,
    `Expected 3 text messages sorted by SENT_TIME, got ${textMessagesBySentAsc.length}`
  )
  assert(
    textMessagesBySentAsc[0].content() === 'message 1',
    `Expected first message to be 'message 1' when sorted by SENT_TIME ascending, got '${textMessagesBySentAsc[0].content()}'`
  )
  assert(
    textMessagesBySentAsc[2].content() === 'message 3',
    `Expected last message to be 'message 3' when sorted by SENT_TIME ascending, got '${textMessagesBySentAsc[2].content()}'`
  )

  // Fetch messages sorted by SENT_TIME descending
  const messagesBySentDesc = await alixGroup.messages({
    direction: 'DESCENDING',
    sortBy: 'SENT_TIME',
  })
  const textMessagesBySentDesc = messagesBySentDesc.filter(
    (m) =>
      typeof m.content() === 'string' &&
      (m.content() as string).startsWith('message')
  )
  assert(
    textMessagesBySentDesc[0].content() === 'message 3',
    `Expected first message to be 'message 3' when sorted by SENT_TIME descending, got '${textMessagesBySentDesc[0].content()}'`
  )

  // Fetch messages sorted by INSERTED_TIME ascending
  const messagesByInsertedAsc = await alixGroup.messages({
    direction: 'ASCENDING',
    sortBy: 'INSERTED_TIME',
  })
  const textMessagesByInsertedAsc = messagesByInsertedAsc.filter(
    (m) =>
      typeof m.content() === 'string' &&
      (m.content() as string).startsWith('message')
  )
  assert(
    textMessagesByInsertedAsc.length === 3,
    `Expected 3 text messages sorted by INSERTED_TIME, got ${textMessagesByInsertedAsc.length}`
  )
  // Verify ordering: inserted time should be in ascending order
  for (let i = 0; i < textMessagesByInsertedAsc.length - 1; i++) {
    assert(
      textMessagesByInsertedAsc[i].insertedAtNs <=
        textMessagesByInsertedAsc[i + 1].insertedAtNs,
      `Messages not in ascending INSERTED_TIME order at index ${i}`
    )
  }

  // Fetch messages sorted by INSERTED_TIME descending
  const messagesByInsertedDesc = await alixGroup.messages({
    direction: 'DESCENDING',
    sortBy: 'INSERTED_TIME',
  })
  const textMessagesByInsertedDesc = messagesByInsertedDesc.filter(
    (m) =>
      typeof m.content() === 'string' &&
      (m.content() as string).startsWith('message')
  )
  assert(
    textMessagesByInsertedDesc[0].content() === 'message 3',
    `Expected first message to be 'message 3' when sorted by INSERTED_TIME descending, got '${textMessagesByInsertedDesc[0].content()}'`
  )
  // Verify ordering: inserted time should be in descending order
  for (let i = 0; i < textMessagesByInsertedDesc.length - 1; i++) {
    assert(
      textMessagesByInsertedDesc[i].insertedAtNs >=
        textMessagesByInsertedDesc[i + 1].insertedAtNs,
      `Messages not in descending INSERTED_TIME order at index ${i}`
    )
  }

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
