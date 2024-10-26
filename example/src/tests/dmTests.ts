import { Wallet } from 'ethers'
import { Platform } from 'expo-modules-core'
import { DecodedMessage } from 'xmtp-react-native-sdk/lib/DecodedMessage'

import {
  Test,
  assert,
  createClients,
  createV3Clients,
  delayToPropogate,
} from './test-utils'
import {
  Client,
  Conversation,
  Dm,
  Group,
  ConversationContainer,
  ConversationVersion,
} from '../../../src/index'

export const dmTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  dmTests.push({ name: String(counter++) + '. ' + name, run: perform })
}

test('can find a conversations by id', async () => {
  const [alixClient, boClient] = await createV3Clients(2)
  const alixGroup = await alixClient.conversations.newGroup([boClient.address])
  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.address)

  await boClient.conversations.syncConversations()
  const boGroup = await boClient.conversations.findConversation(alixGroup.id)
  const boDm = await boClient.conversations.findConversation(alixDm.id)

  assert(
    boGroup?.id === alixGroup.id,
    `bo group id ${boGroup?.id} does not match alix group id ${alixGroup.id}`
  )

  assert(
    boDm?.id === alixDm.id,
    `bo dm id ${boDm?.id} does not match alix dm id ${alixDm.id}`
  )

  return true
})

test('can find a conversation by topic', async () => {
  const [alixClient, boClient] = await createV3Clients(2)
  const alixGroup = await alixClient.conversations.newGroup([boClient.address])
  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.address)

  await boClient.conversations.syncConversations()
  const boGroup = await boClient.conversations.findConversationByTopic(
    alixGroup.topic
  )
  const boDm = await boClient.conversations.findConversationByTopic(
    alixDm.topic
  )

  assert(
    boGroup?.id === alixGroup.id,
    `bo group topic ${boGroup?.id} does not match alix group topic ${alixGroup.id}`
  )

  assert(
    boDm?.id === alixDm.id,
    `bo dm topic ${boDm?.id} does not match alix dm topic ${alixDm.id}`
  )

  return true
})

test('can find a dm by address', async () => {
  const [alixClient, boClient] = await createV3Clients(2)
  const alixDm = await alixClient.conversations.findOrCreateDm(boClient.address)

  await boClient.conversations.syncConversations()
  const boDm = await boClient.conversations.findDm(alixClient.address)

  assert(
    boDm?.id === alixDm.id,
    `bo dm id ${boDm?.id} does not match alix dm id ${alixDm.id}`
  )

  return true
})
