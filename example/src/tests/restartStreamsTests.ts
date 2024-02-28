import { Test, assert, createClients, delayToPropogate } from './test-utils'

export const restartStreamTests: Test[] = []

function test(name: string, perform: () => Promise<boolean>) {
  restartStreamTests.push({ name, run: perform })
}

test('Can cancel a stream and restart', async () => {
  // Create clients
  const [alix, bo, caro, davon] = await createClients(4)

  // Start stream
  let numEvents1 = 0
  await alix.conversations.stream(async (_) => {
    console.log('stream event 1')
    numEvents1++
  })
  await delayToPropogate()
  await alix.conversations.newConversation(bo.address)
  await delayToPropogate()
  assert(numEvents1 === 1, 'expected 1 event, first stream')

  // Cancel stream
  alix.conversations.cancelStream()
  await alix.conversations.newConversation(caro.address)
  await delayToPropogate()
  assert(numEvents1 === 1, 'expected 1 event, first stream after cancel')

  // Start new stream
  let numEvents2 = 0
  await alix.conversations.stream(async (_) => {
    console.log('stream event 2')
    numEvents2++
  })
  await delayToPropogate()

  await alix.conversations.newConversation(davon.address)
  await delayToPropogate()

  // Verify correct number of events from each stream
  assert(
    numEvents1 === 1,
    'expected 1 event, first stream after cancel, but found ' + numEvents1
  )
  assert(
    numEvents2 === 1,
    'expected 1 event, second stream, but found ' + numEvents2
  )

  return true
})

// Existing issue, client who started stream, creating groups will not
// be streamed
test('Can cancel a streamGroups and restart', async () => {
  // Create clients
  const [alix, bo, caro, davon] = await createClients(4)

  // Start stream
  let numEvents1 = 0
  await alix.conversations.streamGroups(async (_) => {
    console.log('stream event 1')
    numEvents1++
  })
  await delayToPropogate()
  await bo.conversations.newGroup([alix.address])
  await delayToPropogate()
  assert(numEvents1 === 1, 'expected 1 event, first stream')

  // Cancel stream
  alix.conversations.cancelStreamGroups()
  await caro.conversations.newGroup([alix.address])
  await delayToPropogate()
  assert(numEvents1 === 1, 'expected 1 event, first stream after cancel')

  // Start new stream
  let numEvents2 = 0
  await alix.conversations.streamGroups(async (_) => {
    console.log('stream event 2')
    numEvents2++
  })
  await delayToPropogate()

  await davon.conversations.newGroup([alix.address])
  await delayToPropogate()

  // Verify correct number of events from each stream
  assert(
    numEvents1 === 1,
    'expected 1 event, first stream after cancel, but found ' + numEvents1
  )
  assert(
    numEvents2 === 1,
    'expected 1 event, second stream, but found ' + numEvents2
  )

  return true
})

test('Can cancel a streamAllMessages and restart', async () => {
  // Create clients
  const [alix, bo] = await createClients(2)

  // Create a group
  await delayToPropogate()
  await bo.conversations.newGroup([alix.address])
  await bo.conversations.newConversation(alix.address)
  await delayToPropogate()

  // Start stream
  let numEvents1 = 0
  await alix.conversations.streamAllMessages(async (_) => {
    console.log('stream event 1')
    numEvents1++
  }, true)
  await delayToPropogate()

  // Send one Group message and one Conversation Message
  const boGroup = (await bo.conversations.listGroups())[0]
  const boConversation = (await bo.conversations.list())[0]

  await boGroup.send('test')
  await boConversation.send('test')
  await delayToPropogate()

  assert(
    numEvents1 === 2,
    'expected 2 events, first stream, but found ' + numEvents1
  )

  // Cancel stream
  alix.conversations.cancelStreamAllMessages()
  await boGroup.send('test')
  await boConversation.send('test')
  await delayToPropogate()
  assert(numEvents1 === 2, 'expected 1 event, first stream after cancel')

  // Start new stream
  let numEvents2 = 0
  await alix.conversations.streamAllMessages(async (_) => {
    console.log('stream event 2')
    numEvents2++
  }, true)
  await delayToPropogate()

  await boGroup.send('test')
  await boConversation.send('test')
  await delayToPropogate()

  // Verify correct number of events from each stream
  assert(
    numEvents1 === 2,
    'expected 2 events, first stream after cancel, but found ' + numEvents1
  )
  assert(
    numEvents2 === 2,
    'expected 2 events, second stream, but found ' + numEvents2
  )

  return true
})
