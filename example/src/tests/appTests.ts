import RNFS from 'react-native-fs'

import { Test, assert, createClients, delayToPropogate } from './test-utils'
import { Client, Group } from '../../../src/index'

export const appTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  appTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

// test('stream example', async () => {
//   const [alice, bob] = await createClients(2)

//   const aliceGroups = await alice.conversations.listGroups()
//   assert(aliceGroups.length === 0, 'alice should have no groups')

//   let groupCallbacks = 0
//   let messageCallbacks = 0

//   await alice.conversations.streamGroups(async () => {
//     groupCallbacks++
//   })

//   await alice.conversations.streamAllMessages(async () => {
//     messageCallbacks++
//   }, true)

//   await delayToPropogate()

//   const group = await bob.conversations.newGroup([alice.address])
//   await group.send('hello')

//   assert(group instanceof Group, 'group should be a Group')

//   await delayToPropogate()

//   assert(groupCallbacks === 1, 'group stream should have received 1 group')
//   assert(
//     messageCallbacks === 1,
//     'message stream should have received 1 message'
//   )

//   return true
// })

// test('installation', async () => {
//   const [alice] = await createClients(1)
//   const aliceKey = await alice.exportKeyBundle()
//   await Client.createFromKeyBundle(aliceKey, {
//     env: 'local',
//   })

//   return true
// })

// test('can list groups', async () => {
//   const now = Date.now()
//   const [alice, bo] = await createClients(2)
//   console.log('created clients')
//   const aliceGroup = await alice.conversations.newGroup([bo.address])
//   await aliceGroup.updateGroupName('hello')
//   await aliceGroup.sync()
//   await aliceGroup.send('hello1')
//   console.log('starting stream')
//   await bo.conversations.streamAllMessages(async () => {
//     console.log('message received')
//   }, true)

//   await bo.conversations.syncGroups()
//   const bobGroups = await bo.conversations.listGroups()
//   assert(bobGroups.length === 1, 'bob should have 1 group')
//   await bo.conversations.streamAllMessages(async () => {
//     console.log('message received')
//   }, true)
//   const bobGroup = bobGroups[0]
//   await bobGroup.sync()
//   await bobGroup.streamGroupMessages(async () => {
//     console.log('message received on group')
//   })
//   const bobMessages1 = await bobGroup.messages({
//     direction: 'SORT_DIRECTION_DESCENDING',
//     after: now,
//   })

//   assert(
//     bobMessages1.length === 2,
//     `should have 2 messages on first load received ${bobMessages1.length}`
//   )
//   await aliceGroup.send('hello2')
//   await bobGroup.sync()
//   await bobGroup.send('hello3')
//   await aliceGroup.send('hello4')
//   await aliceGroup.send('hello5')
//   await bobGroup.sync()
//   const bobMessages2 = await bobGroup.messages()
//   assert(
//     bobMessages2.length === 6,
//     `should have 6 messages on second load received ${bobMessages2.length}`
//   )
//   return true
// })

test('can list groups', async () => {
  const [alix, bo] = await createClients(2)
  console.log('created clients')
  let groupCallbacks = 0
  //#region Stream groups
  await bo.conversations.streamGroups(async () => {
    console.log('group received')
    groupCallbacks++
  })
  //#region Stream All Messages
  await bo.conversations.streamAllMessages(async () => {
    console.log('message received')
  }, false) // <<--------- Changing this to true will cause the test to fail
  //#endregion
  // #region create group
  const alixGroup = await alix.conversations.newGroup([bo.address])
  await alixGroup.updateGroupName('hello')
  await alixGroup.send('hello1')
  console.log('sent group message')
  // #endregion
  // #region sync groups
  await bo.conversations.syncGroups()
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

  assert(groupCallbacks === 1, 'group stream should have received 1 group')

  return true
})
