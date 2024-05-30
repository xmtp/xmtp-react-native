import { Test, assert, createClients } from './test-utils'

export const groupPermissionsTests: Test[] = []
let counter = 1
function test(name: string, perform: () => Promise<boolean>) {
  groupPermissionsTests.push({
    name: String(counter++) + '. ' + name,
    run: perform,
  })
}

test('new group has expected admin list and super admin list', async () => {
  // Create clients
  const [alix, bo] = await createClients(2)

  // Alix Create a group
  const alixGroup = await alix.conversations.newGroup([bo.address])

  // Alix is the only admin and the only super admin
  const adminList = await alixGroup.listAdmins()
  const superAdminList = await alixGroup.listSuperAdmins()

  assert(
    adminList.length === 1,
    `adminList.length should be 1 but was ${adminList.length}`
  )
  assert(
    adminList[0] === alix.inboxId,
    `adminList[0] should be ${alix.address} but was ${adminList[0]}`
  )
  assert(
    superAdminList.length === 1,
    `superAdminList.length should be 1 but was ${superAdminList.length}`
  )
  assert(
    superAdminList[0] === alix.inboxId,
    `superAdminList[0] should be ${alix.address} but was ${superAdminList[0]}`
  )
  return true
})

test('super admin can add a new admin', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  // Alix Create a group
  const alixGroup = await alix.conversations.newGroup([
    bo.address,
    caro.address,
  ])

  // Verify alix is a super admin and bo is not
  const alixIsSuperAdmin = await alixGroup.isSuperAdmin(alix.inboxId)
  const boIsSuperAdmin = await alixGroup.isSuperAdmin(bo.inboxId)

  assert(alixIsSuperAdmin, `alix should be a super admin`)
  assert(!boIsSuperAdmin, `bo should not be a super admin`)

  // Verify that bo can not add a new admin
  await bo.conversations.syncGroups()
  const boGroup = (await bo.conversations.listGroups())[0]
  try {
    await boGroup.addAdmin(caro.inboxId)
    throw new Error(
      'Expected exception when non-super admin attempts to add an admin.'
    )
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  // Alix adds bo as an admin
  await alixGroup.addAdmin(bo.inboxId)
  await alix.conversations.syncGroups()
  const alixGroupIsAdmin = await alixGroup.isAdmin(bo.inboxId)
  assert(alixGroupIsAdmin, `alix should be an admin`)

  return true
})

test('in admin only group, members can not update group name unless they are an admin', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  // Alix Create a group
  const alixGroup = await alix.conversations.newGroup(
    [bo.address, caro.address],
    'admin_only'
  )

  if (alixGroup.permissionLevel !== 'admin_only') {
    throw Error(
      `Group permission level should be admin_only but was ${alixGroup.permissionLevel}`
    )
  }

  // Verify group name is New Group
  const groupName = await alixGroup.groupName()
  assert(
    groupName === 'New Group',
    `group name should be New Group but was ${groupName}`
  )

  // Verify that bo can not update the group name
  await bo.conversations.syncGroups()
  const boGroup = (await bo.conversations.listGroups())[0]
  try {
    await boGroup.updateGroupName("bo's group")
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return true
  }
  return false
})

test('in admin only group, members can update group name once they are an admin', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  // Alix Create a group
  const alixGroup = await alix.conversations.newGroup(
    [bo.address, caro.address],
    'admin_only'
  )

  if (alixGroup.permissionLevel !== 'admin_only') {
    throw Error(
      `Group permission level should be admin_only but was ${alixGroup.permissionLevel}`
    )
  }

  // Verify group name is New Group
  let groupName = await alixGroup.groupName()
  assert(
    groupName === 'New Group',
    `group name should be New Group but was ${groupName}`
  )

  // Verify that bo can not update the group name
  await bo.conversations.syncGroups()
  const boGroup = (await bo.conversations.listGroups())[0]
  try {
    await boGroup.updateGroupName("bo's group")
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  // Alix adds bo as an admin
  await alixGroup.addAdmin(bo.inboxId)
  await alix.conversations.syncGroups()
  const alixGroupIsAdmin = await alixGroup.isAdmin(bo.inboxId)
  assert(alixGroupIsAdmin, `alix should be an admin`)

  // Now bo can update the group name
  await boGroup.sync()
  await boGroup.updateGroupName("bo's group")
  groupName = await boGroup.groupName()
  assert(
    groupName === "bo's group",
    `group name should be bo's group but was ${groupName}`
  )

  return true
})

test('in admin only group, members can not update group name after admin status is removed', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  // Alix Create a group
  const alixGroup = await alix.conversations.newGroup(
    [bo.address, caro.address],
    'admin_only'
  )

  if (alixGroup.permissionLevel !== 'admin_only') {
    throw Error(
      `Group permission level should be admin_only but was ${alixGroup.permissionLevel}`
    )
  }

  // Verify group name is New Group
  let groupName = await alixGroup.groupName()
  assert(
    groupName === 'New Group',
    `group name should be New Group but was ${groupName}`
  )

  // Alix adds bo as an admin
  await alixGroup.addAdmin(bo.inboxId)
  await alix.conversations.syncGroups()
  let boIsAdmin = await alixGroup.isAdmin(bo.inboxId)
  assert(boIsAdmin, `bo should be an admin`)

  // Now bo can update the group name
  await bo.conversations.syncGroups()
  const boGroup = (await bo.conversations.listGroups())[0]
  await boGroup.sync()
  await boGroup.updateGroupName("bo's group")
  await alixGroup.sync()
  groupName = await alixGroup.groupName()
  assert(
    groupName === "bo's group",
    `group name should be bo's group but was ${groupName}`
  )

  // Now alix removed bo as an admin
  await alixGroup.removeAdmin(bo.inboxId)
  await alix.conversations.syncGroups()
  boIsAdmin = await alixGroup.isAdmin(bo.inboxId)
  assert(!boIsAdmin, `bo should not be an admin`)

  // Bo can no longer update the group name
  try {
    await boGroup.updateGroupName('new name 2')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected error
  }

  await alixGroup.sync()
  groupName = await alixGroup.groupName()
  assert(
    groupName === "bo's group",
    `group name should be bo's group but was ${groupName}`
  )

  // throw new Error('Expected exception when non-admin attempts to update group name.')
  return true
})
