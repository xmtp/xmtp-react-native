import { Wallet } from 'ethers'
import RNFS from 'react-native-fs'

import { Test, assert, createClients, delayToPropogate } from './test-utils'
import { Client, Group } from '../../../src/index'
import { DefaultContentTypes } from 'xmtp-react-native-sdk/lib/types/DefaultContentType'

export const clientTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  clientTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('groups cannot fork', async () => {
  const [alix, bo, new_one, new_two] = await createClients(4)
  // Create group with 2 users
  const alixGroup = await alix.conversations.newGroup([
    bo.address,
    new_one.address,
    new_two.address,
  ])

  // sync clients
  await alix.conversations.sync()
  await bo.conversations.sync()
  const boGroup: Group<DefaultContentTypes> = (await bo.conversations.findGroup(alixGroup.id))!

  // Remove two members in parallel
  // NB => if we don't use Promise.all but a loop, we don't get a fork
  console.log('*************libxmtp*********************: Removing members in parallel')
  await Promise.all([
    (async () => {
      try { 
        await alixGroup.removeMembers([new_one.address])
      } catch (e) {
        console.log('Error removing member', e)
      }
    })(),
    (async () => {
      try { 
        await alixGroup.removeMembers([new_two.address])
      } catch (e) {
        console.log('Error removing member', e)
      }
    })()
  ])

  // Helper to send a message from a bunch of senders and make sure it is received by all receivers
  const testMessageSending = async (senderGroup: Group<DefaultContentTypes>, receiverGroup: Group<DefaultContentTypes>) => {
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
      `${receiverGroup.client.address} sees ${messages.length} messages in group`
    )
    assert(
      lastMessage !== undefined &&
        lastMessage.nativeContent.text === messageContent,
      `${receiverGroup.client.address} should have received the message, FORK? ${lastMessage?.nativeContent.text} !== ${messageContent}`
    )
  }
  // When forked, it stays forked even if we try 5 times
  // but sometimes it is not forked and works 5/5 times
  let forkCount = 0
  const tryCount = 5
  for (let i = 0; i < tryCount; i++) {
    console.log(`Checking fork status ${i+1}/${tryCount}`)
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
