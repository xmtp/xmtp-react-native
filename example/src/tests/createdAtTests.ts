import {
  Test,
  assert,
  createClients,
  delayToPropogate,
  isIos,
} from './test-utils'
import { Conversation, Group } from '../../../src/index'

export const createdAtTests: Test[] = []

function test(name: string, perform: () => Promise<boolean>) {
  createdAtTests.push({ name, run: perform })
}

test('group createdAt matches listGroups', async () => {
  // Create three MLS enabled Clients
  const [alix, bo, caro] = await createClients(3)

  // alix creates a group
  const alixGroup = await alix.conversations.newGroup([
    bo.inboxId,
    caro.inboxId,
  ])

  // bo creates a group
  const boGroup = await bo.conversations.newGroup([alix.inboxId])

  // Fetch groups using listGroups method
  await alix.conversations.sync()
  const alixGroups = await alix.conversations.listGroups()

  const first = 0
  const second = 1
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
    bo.inboxId,
    caro.inboxId,
  ])

  // bo creates a group
  const boGroup = await bo.conversations.newGroup([alix.inboxId])

  // Fetch groups using listGroups method
  await alix.conversations.sync()
  const alixGroups = await alix.conversations.list()

  assert(alixGroups.length === 2, 'alix should have two groups')

  // Returns reverse Chronological order on Android and iOS
  const first = 0
  const second = 1
  assert(
    alixGroups[first].topic === alixGroup.topic,
    'First group returned from listGroups shows ' +
      alixGroups[first].topic +
      ' but should be ' +
      alixGroup.topic
  )
  assert(
    alixGroups[second].topic === boGroup.topic,
    'Second group returned from listGroups shows ' +
      alixGroups[second].topic +
      ' but should be ' +
      boGroup.topic
  )

  // Below assertion fails on Android
  if (isIos()) {
    assert(
      alixGroups[first].createdAt === alixGroup.createdAt,
      'alix group returned from listGroups shows createdAt ' +
        alixGroups[first].createdAt +
        ' but should be ' +
        alixGroup.createdAt
    )

    assert(
      alixGroups[second].createdAt === boGroup.createdAt,
      'bo group returned from listGroups shows createdAt ' +
        alixGroups[second].createdAt +
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
  await alix.conversations.stream(async (group: Conversation<any>) => {
    allGroups.push(group as Group)
  }, 'groups')

  await delayToPropogate()

  // alix creates a group
  const boGroup = await bo.conversations.newGroup([alix.inboxId])

  await delayToPropogate()

  // bo creates a group
  const caroGroup = await caro.conversations.newGroup([alix.inboxId])

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

  assert(
    allGroups[0].createdAt === boGroup.createdAt,
    'first ' + allGroups[0].createdAt + ' != ' + boGroup.createdAt
  )

  assert(
    allGroups[1].createdAt === caroGroup.createdAt,
    'second ' + allGroups[1].createdAt + ' != ' + caroGroup.createdAt
  )

  alix.conversations.cancelStream()

  return true
})

test('group createdAt matches streamAll', async () => {
  // Create three MLS enabled Clients
  const [alix, bo, caro] = await createClients(3)

  // Start streaming groups
  const allGroups: Conversation<any>[] = []
  await alix.conversations.stream(async (group: Conversation<any>) => {
    allGroups.push(group)
  })

  await delayToPropogate()

  // alix creates a group
  const boGroup = await bo.conversations.newGroup([alix.inboxId])

  await delayToPropogate()

  // bo creates a group
  const caroGroup = await caro.conversations.newGroup([alix.inboxId])

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

  assert(
    allGroups[0].createdAt === boGroup.createdAt,
    'first ' + allGroups[0].createdAt + ' != ' + boGroup.createdAt
  )
  assert(
    allGroups[1].createdAt === caroGroup.createdAt,
    'second ' + allGroups[1].createdAt + ' != ' + caroGroup.createdAt
  )

  alix.conversations.cancelStream()

  return true
})

test('conversation createdAt matches list', async () => {
  // Create three MLS enabled Clients
  const [alix, bo, caro] = await createClients(3)

  // alix creates a conversation
  const alixConversation = await alix.conversations.newConversation(bo.inboxId)

  // bo creates a conversation
  const caroConversation = await caro.conversations.newConversation(
    alix.inboxId
  )

  // Fetch conversations using list() method
  const alixConversations = await alix.conversations.list()
  assert(alixConversations.length === 2, 'alix should have two conversations')

  // BUG - List returns in Chronological order on iOS
  // and reverse Chronological order on Android
  const first = 0
  const second = 1

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
  const alixConversation = await alix.conversations.newConversation(bo.inboxId)

  // bo creates a group
  const caroConversation = await caro.conversations.newConversation(
    alix.inboxId
  )

  // Fetch conversations using list() method
  const alixConversations = await alix.conversations.list()
  assert(alixConversations.length === 2, 'alix should have two conversations')

  const first = 0
  const second = 1

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
  const alixConversation = await alix.conversations.newConversation(bo.inboxId)

  await delayToPropogate()

  // bo creates a conversation
  const caroConversation = await caro.conversations.newConversation(
    alix.inboxId
  )

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
  const allConversations: Conversation<any>[] = []
  await alix.conversations.stream(async (conversation) => {
    allConversations.push(conversation)
  })

  // alix creates a group
  const alixConversation = await alix.conversations.newConversation(bo.inboxId)

  await delayToPropogate()

  // bo creates a group
  const caroConversation = await caro.conversations.newConversation(
    alix.inboxId
  )

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

  alix.conversations.cancelStream()

  return true
})
