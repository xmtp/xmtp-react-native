import {
  Test,
  assert,
  createClients,
  delayToPropogate,
  isIos,
} from './test-utils'
import { Conversation, ConversationContainer, Group } from '../../../src/index'

export const createdAtTests: Test[] = []

function test(name: string, perform: () => Promise<boolean>) {
  createdAtTests.push({ name, run: perform })
}

test('group createdAt matches listGroups', async () => {
  // Create three MLS enabled Clients
  const [alix, bo, caro] = await createClients(3)

  // alix creates a group
  const alixGroup = await alix.conversations.newGroup([
    bo.address,
    caro.address,
  ])

  // bo creates a group
  const boGroup = await bo.conversations.newGroup([alix.address])

  // Fetch groups using listGroups method
  await alix.conversations.syncGroups()
  const alixGroups = await alix.conversations.listGroups()

  // BUG - List returns in Reverse Chronological order on iOS
  // and Chronological order on Android
  const first = isIos() ? 1 : 0
  const second = isIos() ? 0 : 1
  assert(alixGroups.length === 2, 'Alix should have two groups')
  assert(
    alixGroups[first].id === alixGroup.id,
    'First group returned from listGroups should be the first group created'
  )
  assert(
    alixGroups[first].createdAt === alixGroup.createdAt,
    'Alix group createdAt should match'
  )
  assert(
    alixGroups[second].id === boGroup.id,
    'Bo group createdAt should match'
  )
  // Below assertion fails on Android
  if (isIos()) {
    assert(
      alixGroups[second].createdAt === boGroup.createdAt,
      'Second group returned from listGroups shows ' +
      alixGroups[second].createdAt +
        ' but should be ' +
        boGroup.createdAt
    )
  }
  return true
})

test('group createdAt matches listAll', async () => {
  // Create three MLS enabled Clients
  const [alix, bo, caro] = await createClients(3)

  // alix creates a group
  const alixGroup = await alix.conversations.newGroup([
    bo.address,
    caro.address,
  ])

  // bo creates a group
  const boGroup = await bo.conversations.newGroup([alix.address])

  // Fetch groups using listGroups method
  await alix.conversations.syncGroups()
  const alixGroups = await alix.conversations.listAll()

  assert(alixGroups.length === 2, 'alix should have two groups')

  // Returns reverse Chronological order on Android and iOS
  const first = 1
  const second = 0
  assert(
    alixGroups[first].topic === alixGroup.id,
    'First group returned from listGroups shows ' +
      (alixGroups[1] as Group).id +
      ' but should be ' +
      alixGroup.id
  )
  assert(
    alixGroups[second].topic === boGroup.id,
    'Second group returned from listGroups shows ' +
      (alixGroups[0] as Group).id +
      ' but should be ' +
      boGroup.id
  )
  assert(
    alixGroups[first].createdAt === alixGroup.createdAt,
    'alix group returned from listGroups shows createdAt ' +
    alixGroups[1].createdAt +
      ' but should be ' +
      alixGroup.createdAt
  )
  // Below assertion fail on Android
  if (isIos()) {
    assert(
      alixGroups[second].createdAt === boGroup.createdAt,
      'bo group returned from listGroups shows createdAt ' +
      alixGroups[0].createdAt +
        ' but should be ' +
        boGroup.createdAt
    )
  }
  return true
})

test('group createdAt matches streamGroups', async () => {
  // Create three MLS enabled Clients
  const [alix, bo, caro] = await createClients(3)

  // Start streaming groups
  const allGroups: Group<any>[] = []
  const cancelStream = await alix.conversations.streamGroups(
    async (group: Group<any>) => {
      allGroups.push(group)
    }
  )

  await delayToPropogate()

  // alix creates a group
  const boGroup = await bo.conversations.newGroup([alix.address])

  await delayToPropogate()

  // bo creates a group
  const caroGroup = await caro.conversations.newGroup([alix.address])

  await delayToPropogate()

  assert(allGroups.length === 2, 'alix should have two groups')

  // Stream returns in chronological order
  assert(
    allGroups[0].id === boGroup.id,
    'first ' + allGroups[0].id + ' != ' + boGroup.id
  )
  assert(
    allGroups[1].id === caroGroup.id,
    'second ' + allGroups[1].id + ' != ' + caroGroup.id
  )

  // CreatedAt returned from stream matches createAt from create function
  // Assertion below fails on Android
  if (isIos()) {
    assert(
      allGroups[0].createdAt === boGroup.createdAt,
      'first ' + allGroups[0].createdAt + ' != ' + boGroup.createdAt
    )

    assert(
      allGroups[1].createdAt === caroGroup.createdAt,
      'second ' + allGroups[1].createdAt + ' != ' + caroGroup.createdAt
    )
  }

  cancelStream()

  return true
})

test('group createdAt matches streamAll', async () => {
  // Create three MLS enabled Clients
  const [alix, bo, caro] = await createClients(3)

  // Start streaming groups
  const allGroups: ConversationContainer<any>[] = []
  const cancelStream = await alix.conversations.streamAll(
    async (group: ConversationContainer<any>) => {
      allGroups.push(group)
    }
  )

  await delayToPropogate()

  // alix creates a group
  const boGroup = await bo.conversations.newGroup([alix.address])

  await delayToPropogate()

  // bo creates a group
  const caroGroup = await caro.conversations.newGroup([alix.address])

  await delayToPropogate()

  assert(allGroups.length === 2, 'alix should have two groups')

  // Stream returns in chronological order
  assert(
    allGroups[0].topic === boGroup.topic,
    'first ' + allGroups[0].topic + ' != ' + boGroup.topic
  )
  assert(
    allGroups[1].topic === caroGroup.topic,
    'second ' + allGroups[1].topic + ' != ' + caroGroup.topic
  )

  // CreatedAt returned from stream matches createAt from create function
  // Assertion below fails on Android
  if (isIos()) {
    assert(
      allGroups[0].createdAt === boGroup.createdAt,
      'first ' + allGroups[0].createdAt + ' != ' + boGroup.createdAt
    )
    assert(
      allGroups[1].createdAt === caroGroup.createdAt,
      'second ' + allGroups[1].createdAt + ' != ' + caroGroup.createdAt
    )
  }

  cancelStream()

  return true
})

test('conversation createdAt matches list', async () => {
  // Create three MLS enabled Clients
  const [alix, bo, caro] = await createClients(3)

  // alix creates a conversation
  const alixConversation = await alix.conversations.newConversation(bo.address)

  // bo creates a conversation
  const caroConversation = await caro.conversations.newConversation(alix.address)

  // Fetch conversations using list() method
  const alixConversations = await alix.conversations.list()
  assert(alixConversations.length === 2, 'alix should have two conversations')

  // BUG - List returns in Chronological order on iOS
  // and reverse Chronological order on Android
  const first = isIos() ? 0 : 1
  const second = isIos() ? 1 : 0

  assert(
    alixConversations[first].topic === alixConversation.topic,
    alixConversations[first].topic + ' != ' + alixConversation.topic
  )
  assert(
    alixConversations[second].topic === caroConversation.topic,
    alixConversations[second].topic + ' != ' + caroConversation.topic
  )

  // CreatedAt returned from list matches createAt from create function
  assert(
    alixConversations[first].createdAt === alixConversation.createdAt,
    alixConversations[first].createdAt + ' != ' + alixConversation.createdAt
  )
  assert(
    alixConversations[second].createdAt === caroConversation.createdAt,
    alixConversations[second].createdAt + ' != ' + caroConversation.createdAt
  )

  return true
})

test('conversation createdAt matches listAll', async () => {
  // Create three MLS enabled Clients
  const [alix, bo, caro] = await createClients(3)

  // alix creates a group
  const alixConversation = await alix.conversations.newConversation(bo.address)

  // bo creates a group
  const caroConversation = await caro.conversations.newConversation(alix.address)

  // Fetch conversations using list() method
  const alixConversations = await alix.conversations.listAll()
  assert(alixConversations.length === 2, 'alix should have two conversations')

  // BUG - List returns in Chronological order on iOS
  // and reverse Chronological order on Android
  const first = isIos() ? 0 : 1
  const second = isIos() ? 1 : 0

  // List returns in reverse Chronological order
  assert(
    alixConversations[first].topic === alixConversation.topic,
    alixConversations[first].topic + ' != ' + alixConversation.topic
  )
  assert(
    alixConversations[second].topic === caroConversation.topic,
    alixConversations[second].topic + ' != ' + alixConversation.topic
  )

  // CreatedAt returned from list matches createAt from create function
  assert(
    alixConversations[first].createdAt === alixConversation.createdAt,
    alixConversations[first].createdAt + ' != ' + alixConversation.createdAt
  )
  assert(
    alixConversations[second].createdAt === caroConversation.createdAt,
    alixConversations[second].createdAt + ' != ' + caroConversation.createdAt
  )

  return true
})

test('conversation createdAt matches stream', async () => {
  // Create three MLS enabled Clients
  const [alix, bo, caro] = await createClients(3)

  // Start streaming conversations
  const allConversations: Conversation<any>[] = []
  await alix.conversations.stream(async (conversation) => {
    allConversations.push(conversation)
  })

  // alix creates a conversation
  const alixConversation = await alix.conversations.newConversation(bo.address)

  await delayToPropogate()

  // bo creates a conversation
  const caroConversation = await caro.conversations.newConversation(alix.address)

  await delayToPropogate()

  assert(allConversations.length === 2, 'alix should have two conversations')

  // Stream returns in chronological order
  assert(
    allConversations[0].topic === alixConversation.topic,
    'list()[1].topic: ' +
      allConversations[0].topic +
      ' != ' +
      alixConversation.topic
  )
  assert(
    allConversations[1].topic === caroConversation.topic,
    'list()[0].topic: ' +
      allConversations[1].topic +
      ' != ' +
      caroConversation.topic
  )

  // CreatedAt returned from list matches createAt from create function
  assert(
    allConversations[0].createdAt === alixConversation.createdAt,
    'list()[0].createdAt: ' +
      allConversations[0].createdAt +
      ' != ' +
      alixConversation.createdAt
  )
  assert(
    allConversations[1].createdAt === caroConversation.createdAt,
    'list()[1].createdAt: ' +
      allConversations[1].createdAt +
      ' != ' +
      caroConversation.createdAt
  )

  return true
})

test('conversation createdAt matches streamAll', async () => {
  // Create three MLS enabled Clients
  const [alix, bo, caro] = await createClients(3)

  // Start streaming conversations
  const allConversations: ConversationContainer<any>[] = []
  const cancel = await alix.conversations.streamAll(async (conversation) => {
    allConversations.push(conversation)
  })

  // alix creates a group
  const alixConversation = await alix.conversations.newConversation(bo.address)

  await delayToPropogate()

  // bo creates a group
  const caroConversation = await caro.conversations.newConversation(alix.address)

  await delayToPropogate()

  assert(allConversations.length === 2, 'alix should have two conversations')

  // Stream returns in chronological order
  assert(
    allConversations[0].topic === alixConversation.topic,
    'list()[1].topic: ' +
      allConversations[0].topic +
      ' != ' +
      alixConversation.topic
  )
  assert(
    allConversations[1].topic === caroConversation.topic,
    'list()[0].topic: ' +
      allConversations[1].topic +
      ' != ' +
      caroConversation.topic
  )

  // CreatedAt returned from list matches createAt from create function
  assert(
    allConversations[0].createdAt === alixConversation.createdAt,
    'list()[0].createdAt: ' +
      allConversations[0].createdAt +
      ' != ' +
      alixConversation.createdAt
  )
  assert(
    allConversations[1].createdAt === caroConversation.createdAt,
    'list()[1].createdAt: ' +
      allConversations[1].createdAt +
      ' != ' +
      caroConversation.createdAt
  )

  cancel()

  return true
})
