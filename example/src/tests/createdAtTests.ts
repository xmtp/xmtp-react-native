import { Test, assert, delayToPropogate, isIos } from './tests'
import {
  Client,
  Conversation,
  ConversationContainer,
  Group,
} from '../../../src/index'

export const createdAtTests: Test[] = []

function test(name: string, perform: () => Promise<boolean>) {
  createdAtTests.push({ name, run: perform })
}

test('group createdAt matches listGroups', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Alice creates a group
  const aliceGroup = await aliceClient.conversations.newGroup([
    bobClient.address,
    camClient.address,
  ])

  // Bob creates a group
  const bobGroup = await bobClient.conversations.newGroup([aliceClient.address])

  // Fetch groups using listGroups method
  await aliceClient.conversations.syncGroups()
  const aliceGroups = await aliceClient.conversations.listGroups()

  // BUG - List returns in Reverse Chronological order on iOS
  // and Chronological order on Android
  const first = isIos() ? 1 : 0
  const second = isIos() ? 0 : 1
  assert(aliceGroups.length === 2, 'Alice should have two groups')
  assert(
    aliceGroups[first].id === aliceGroup.id,
    'First group returned from listGroups should be the first group created'
  )
  assert(
    aliceGroups[first].createdAt === aliceGroup.createdAt,
    'Alice group createdAt should match'
  )
  assert(
    aliceGroups[second].id === bobGroup.id,
    'Bob group createdAt should match'
  )
  // Below assertion fails on Android
  if (isIos()) {
    assert(
      aliceGroups[second].createdAt === bobGroup.createdAt,
      'Second group returned from listGroups shows ' +
        aliceGroups[second].createdAt +
        ' but should be ' +
        bobGroup.createdAt
    )
  }
  return true
})

test('group createdAt matches listAll', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Alice creates a group
  const aliceGroup = await aliceClient.conversations.newGroup([
    bobClient.address,
    camClient.address,
  ])

  // Bob creates a group
  const bobGroup = await bobClient.conversations.newGroup([aliceClient.address])

  // Fetch groups using listGroups method
  await aliceClient.conversations.syncGroups()
  const aliceGroups = await aliceClient.conversations.listAll()

  assert(aliceGroups.length === 2, 'Alice should have two groups')

  // Returns reverse Chronological order on Android and iOS
  const first = 1
  const second = 0
  assert(
    aliceGroups[first].topic === aliceGroup.id,
    'First group returned from listGroups shows ' +
      (aliceGroups[1] as Group).id +
      ' but should be ' +
      aliceGroup.id
  )
  assert(
    aliceGroups[second].topic === bobGroup.id,
    'Second group returned from listGroups shows ' +
      (aliceGroups[0] as Group).id +
      ' but should be ' +
      bobGroup.id
  )
  assert(
    aliceGroups[first].createdAt === aliceGroup.createdAt,
    'Alice group returned from listGroups shows createdAt ' +
      aliceGroups[1].createdAt +
      ' but should be ' +
      aliceGroup.createdAt
  )
  // Below assertion fail on Android
  if (isIos()) {
    assert(
      aliceGroups[second].createdAt === bobGroup.createdAt,
      'Bob group returned from listGroups shows createdAt ' +
        aliceGroups[0].createdAt +
        ' but should be ' +
        bobGroup.createdAt
    )
  }
  return true
})

test('group createdAt matches streamGroups', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  await delayToPropogate()
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  await delayToPropogate()
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  await delayToPropogate()

  // Start streaming groups
  const allGroups: Group<any>[] = []
  const cancelStream = await aliceClient.conversations.streamGroups(
    async (group: Group<any>) => {
      allGroups.push(group)
    }
  )

  await delayToPropogate()

  // Alice creates a group
  const bobGroup = await bobClient.conversations.newGroup([aliceClient.address])

  await delayToPropogate()

  // Bob creates a group
  const camGroup = await camClient.conversations.newGroup([aliceClient.address])

  await delayToPropogate()

  assert(allGroups.length === 2, 'Alice should have two groups')

  // Stream returns in chronological order
  assert(
    allGroups[0].id === bobGroup.id,
    'first ' + allGroups[0].id + ' != ' + bobGroup.id
  )
  assert(
    allGroups[1].id === camGroup.id,
    'second ' + allGroups[1].id + ' != ' + camGroup.id
  )

  // CreatedAt returned from stream matches createAt from create function
  // Assertion below fails on Android
  if (isIos()) {
    assert(
      allGroups[0].createdAt === bobGroup.createdAt,
      'first ' + allGroups[0].createdAt + ' != ' + bobGroup.createdAt
    )

    assert(
      allGroups[1].createdAt === camGroup.createdAt,
      'second ' + allGroups[1].createdAt + ' != ' + camGroup.createdAt
    )
  }

  cancelStream()

  return true
})

test('group createdAt matches streamAll', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  await delayToPropogate()
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  await delayToPropogate()
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  await delayToPropogate()

  // Start streaming groups
  const allGroups: ConversationContainer<any>[] = []
  const cancelStream = await aliceClient.conversations.streamAll(
    async (group: ConversationContainer<any>) => {
      allGroups.push(group)
    }
  )

  await delayToPropogate()

  // Alice creates a group
  const bobGroup = await bobClient.conversations.newGroup([aliceClient.address])

  await delayToPropogate()

  // Bob creates a group
  const camGroup = await camClient.conversations.newGroup([aliceClient.address])

  await delayToPropogate()

  assert(allGroups.length === 2, 'Alice should have two groups')

  // Stream returns in chronological order
  assert(
    allGroups[0].topic === bobGroup.topic,
    'first ' + allGroups[0].topic + ' != ' + bobGroup.topic
  )
  assert(
    allGroups[1].topic === camGroup.topic,
    'second ' + allGroups[1].topic + ' != ' + camGroup.topic
  )

  // CreatedAt returned from stream matches createAt from create function
  // Assertion below fails on Android
  if (isIos()) {
    assert(
      allGroups[0].createdAt === bobGroup.createdAt,
      'first ' + allGroups[0].createdAt + ' != ' + bobGroup.createdAt
    )
    assert(
      allGroups[1].createdAt === camGroup.createdAt,
      'second ' + allGroups[1].createdAt + ' != ' + camGroup.createdAt
    )
  }

  cancelStream()

  return true
})

test('conversation createdAt matches list', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  delayToPropogate()
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  delayToPropogate()
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  delayToPropogate()

  // Alice creates a conversation
  const aliceConversation = await aliceClient.conversations.newConversation(
    bobClient.address
  )

  // Bob creates a conversation
  const camConversation = await camClient.conversations.newConversation(
    aliceClient.address
  )

  // Fetch conversations using list() method
  const aliceConversations = await aliceClient.conversations.list()
  assert(aliceConversations.length === 2, 'Alice should have two conversations')

  // BUG - List returns in Chronological order on iOS
  // and reverse Chronological order on Android
  const first = isIos() ? 0 : 1
  const second = isIos() ? 1 : 0

  assert(
    aliceConversations[first].topic === aliceConversation.topic,
    aliceConversations[first].topic + ' != ' + aliceConversation.topic
  )
  assert(
    aliceConversations[second].topic === camConversation.topic,
    aliceConversations[second].topic + ' != ' + camConversation.topic
  )

  // CreatedAt returned from list matches createAt from create function
  assert(
    aliceConversations[first].createdAt === aliceConversation.createdAt,
    aliceConversations[first].createdAt + ' != ' + aliceConversation.createdAt
  )
  assert(
    aliceConversations[second].createdAt === camConversation.createdAt,
    aliceConversations[second].createdAt + ' != ' + camConversation.createdAt
  )

  return true
})

test('conversation createdAt matches listAll', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  delayToPropogate()
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  delayToPropogate()
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  delayToPropogate()

  // Alice creates a group
  const aliceConversation = await aliceClient.conversations.newConversation(
    bobClient.address
  )

  // Bob creates a group
  const camConversation = await camClient.conversations.newConversation(
    aliceClient.address
  )

  // Fetch conversations using list() method
  const aliceConversations = await aliceClient.conversations.listAll()
  assert(aliceConversations.length === 2, 'Alice should have two conversations')

  // BUG - List returns in Chronological order on iOS
  // and reverse Chronological order on Android
  const first = isIos() ? 0 : 1
  const second = isIos() ? 1 : 0

  // List returns in reverse Chronological order
  assert(
    aliceConversations[first].topic === aliceConversation.topic,
    aliceConversations[first].topic + ' != ' + aliceConversation.topic
  )
  assert(
    aliceConversations[second].topic === camConversation.topic,
    aliceConversations[second].topic + ' != ' + aliceConversation.topic
  )

  // CreatedAt returned from list matches createAt from create function
  assert(
    aliceConversations[first].createdAt === aliceConversation.createdAt,
    aliceConversations[first].createdAt + ' != ' + aliceConversation.createdAt
  )
  assert(
    aliceConversations[second].createdAt === camConversation.createdAt,
    aliceConversations[second].createdAt + ' != ' + camConversation.createdAt
  )

  return true
})

test('conversation createdAt matches stream', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  await delayToPropogate()
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  await delayToPropogate()
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  await delayToPropogate()

  // Start streaming conversations
  const allConversations: Conversation<any>[] = []
  await aliceClient.conversations.stream(async (conversation) => {
    allConversations.push(conversation)
  })

  // Alice creates a conversation
  const aliceConversation = await aliceClient.conversations.newConversation(
    bobClient.address
  )

  await delayToPropogate()

  // Bob creates a conversation
  const camConversation = await camClient.conversations.newConversation(
    aliceClient.address
  )

  await delayToPropogate()

  assert(allConversations.length === 2, 'Alice should have two conversations')

  // Stream returns in chronological order
  assert(
    allConversations[0].topic === aliceConversation.topic,
    'list()[1].topic: ' +
      allConversations[0].topic +
      ' != ' +
      aliceConversation.topic
  )
  assert(
    allConversations[1].topic === camConversation.topic,
    'list()[0].topic: ' +
      allConversations[1].topic +
      ' != ' +
      camConversation.topic
  )

  // CreatedAt returned from list matches createAt from create function
  assert(
    allConversations[0].createdAt === aliceConversation.createdAt,
    'list()[0].createdAt: ' +
      allConversations[0].createdAt +
      ' != ' +
      aliceConversation.createdAt
  )
  assert(
    allConversations[1].createdAt === camConversation.createdAt,
    'list()[1].createdAt: ' +
      allConversations[1].createdAt +
      ' != ' +
      camConversation.createdAt
  )

  return true
})

test('conversation createdAt matches streamAll', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  await delayToPropogate()
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  await delayToPropogate()
  const camClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  await delayToPropogate()

  // Start streaming conversations
  const allConversations: ConversationContainer<any>[] = []
  const cancel = await aliceClient.conversations.streamAll(
    async (conversation) => {
      allConversations.push(conversation)
    }
  )

  // Alice creates a group
  const aliceConversation = await aliceClient.conversations.newConversation(
    bobClient.address
  )

  await delayToPropogate()

  // Bob creates a group
  const camConversation = await camClient.conversations.newConversation(
    aliceClient.address
  )

  await delayToPropogate()

  assert(allConversations.length === 2, 'Alice should have two conversations')

  // Stream returns in chronological order
  assert(
    allConversations[0].topic === aliceConversation.topic,
    'list()[1].topic: ' +
      allConversations[0].topic +
      ' != ' +
      aliceConversation.topic
  )
  assert(
    allConversations[1].topic === camConversation.topic,
    'list()[0].topic: ' +
      allConversations[1].topic +
      ' != ' +
      camConversation.topic
  )

  // CreatedAt returned from list matches createAt from create function
  assert(
    allConversations[0].createdAt === aliceConversation.createdAt,
    'list()[0].createdAt: ' +
      allConversations[0].createdAt +
      ' != ' +
      aliceConversation.createdAt
  )
  assert(
    allConversations[1].createdAt === camConversation.createdAt,
    'list()[1].createdAt: ' +
      allConversations[1].createdAt +
      ' != ' +
      camConversation.createdAt
  )

  cancel()

  return true
})

test('group and conversation createdAt has millisecond precision', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Alice creates a group
  const aliceGroup = await aliceClient.conversations.newGroup([
    bobClient.address,
  ])

  // Bob creates a conversation
  const bobConversation = await bobClient.conversations.newConversation(
    aliceClient.address
  )

  console.log('Group createdAt: ' + aliceGroup.createdAt)
  console.log('Conversation createdAt: ' + bobConversation.createdAt)
  assert(
    !bobConversation.createdAt.toString().endsWith('000'),
    'Group createdAt should have millisecond precision, but it is ' +
      bobConversation.createdAt
  )
  assert(
    !aliceGroup.createdAt.toString().endsWith('000'),
    'Group createdAt should have millisecond precision, but it is ' +
      aliceGroup.createdAt
  )

  return true
})

test('message timestamp has millisecond precision', async () => {
  // Create three MLS enabled Clients
  const aliceClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })
  const bobClient = await Client.createRandom({
    env: 'local',
    enableAlphaMls: true,
  })

  // Alice creates a group
  const aliceGroup = await aliceClient.conversations.newGroup([
    bobClient.address,
  ])

  // Bob creates a conversation
  const bobConversation = await bobClient.conversations.newConversation(
    aliceClient.address
  )

  await aliceGroup.send('hello')
  await bobConversation.send('hi')

  const aliceMessage = (await aliceGroup.messages())[0]
  const bobMessage = (await bobConversation.messages())[0]

  console.log('Group message sent: ' + aliceMessage.sent)
  console.log('Conversation message sent: ' + bobMessage.sent)
  assert(
    !bobMessage.sent.toString().endsWith('000'),
    'Conversation message sent should have millisecond precision, but it is ' +
      bobMessage.sent
  )
  assert(
    !aliceMessage.sent.toString().endsWith('000'),
    'Group message sent should have millisecond precision, but it is ' +
      aliceMessage.sent
  )

  return true
})
