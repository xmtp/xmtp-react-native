import { PermissionPolicySet } from 'xmtp-react-native-sdk/lib/types/PermissionPolicySet'

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
  const alixGroup = await alix.conversations.newGroup([bo.inboxId])

  // Alix is the only admin and the only super admin
  const adminList = await alixGroup.listAdmins()
  const superAdminList = await alixGroup.listSuperAdmins()

  assert(
    adminList.length === 0,
    `adminList.length should be 0 but was ${adminList.length}`
  )
  assert(
    superAdminList.length === 1,
    `superAdminList.length should be 1 but was ${superAdminList.length}`
  )
  assert(
    superAdminList[0] === alix.inboxId,
    `superAdminList[0] should be ${alix.inboxId} but was ${superAdminList[0]}`
  )
  return true
})

test('super admin can add a new admin', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  // Alix Create a group
  const alixGroup = await alix.conversations.newGroup([
    bo.inboxId,
    caro.inboxId,
  ])

  // Verify alix is a super admin and bo is not
  const alixIsSuperAdmin = await alixGroup.isSuperAdmin(alix.inboxId)
  const boIsSuperAdmin = await alixGroup.isSuperAdmin(bo.inboxId)

  assert(alixIsSuperAdmin, `alix should be a super admin`)
  assert(!boIsSuperAdmin, `bo should not be a super admin`)

  // Verify that bo can not add a new admin
  await bo.conversations.sync()
  const boGroup = (await bo.conversations.listGroups())[0]
  try {
    await boGroup.addAdmin(caro.inboxId)
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  // Alix adds bo as an admin
  await alixGroup.addAdmin(bo.inboxId)
  await alix.conversations.sync()
  const alixGroupIsAdmin = await alixGroup.isAdmin(bo.inboxId)
  assert(alixGroupIsAdmin, `alix should be an admin`)

  return true
})

test('in admin only group, members can not update group name unless they are an admin', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  // Alix Create a group
  const alixGroup = await alix.conversations.newGroup(
    [bo.inboxId, caro.inboxId],
    { permissionLevel: 'admin_only' }
  )

  if ((await alixGroup.permissionPolicySet()).addMemberPolicy !== 'admin') {
    throw Error(
      `Group add member policy should be admin but was ${(await alixGroup.permissionPolicySet()).addMemberPolicy}`
    )
  }

  // Verify group name is empty string
  const name = await alixGroup.name()
  assert(name === '', `group name should be empty string but was ${name}`)

  // Verify that bo can not update the group name
  await bo.conversations.sync()
  const boGroup = (await bo.conversations.listGroups())[0]
  try {
    await boGroup.updateName("bo's group")
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
    [bo.inboxId, caro.inboxId],
    { permissionLevel: 'admin_only' }
  )

  if (
    (await alixGroup.permissionPolicySet()).updateGroupNamePolicy !== 'admin'
  ) {
    throw Error(
      `Group update name policy should be admin but was ${(await alixGroup.permissionPolicySet()).updateGroupNamePolicy}`
    )
  }

  // Verify group name is empty string
  let name = await alixGroup.name()
  assert(name === '', `group name should be empty string but was ${name}`)

  // Verify that bo can not update the group name
  await bo.conversations.sync()
  const boGroup = (await bo.conversations.listGroups())[0]
  try {
    await boGroup.updateName("bo's group")
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  // Alix adds bo as an admin
  await alixGroup.addAdmin(bo.inboxId)
  await alix.conversations.sync()
  const alixGroupIsAdmin = await alixGroup.isAdmin(bo.inboxId)
  assert(alixGroupIsAdmin, `alix should be an admin`)

  // Now bo can update the group name
  await boGroup.sync()
  await boGroup.updateName("bo's group")
  name = await boGroup.name()
  assert(
    name === "bo's group",
    `group name should be bo's group but was ${name}`
  )

  return true
})

test('in admin only group, members can not update group name after admin status is removed', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  // Alix Create a group
  const alixGroup = await alix.conversations.newGroup(
    [bo.inboxId, caro.inboxId],
    { permissionLevel: 'admin_only' }
  )

  if (
    (await alixGroup.permissionPolicySet()).updateGroupNamePolicy !== 'admin'
  ) {
    throw Error(
      `Group update name policy should be admin but was ${(await alixGroup.permissionPolicySet()).updateGroupNamePolicy}`
    )
  }

  // Verify group name is empty string
  let name = await alixGroup.name()
  assert(name === '', `group name should be empty string but was ${name}`)

  // Alix adds bo as an admin
  await alixGroup.addAdmin(bo.inboxId)
  await alix.conversations.sync()
  let boIsAdmin = await alixGroup.isAdmin(bo.inboxId)
  assert(boIsAdmin, `bo should be an admin`)

  // Now bo can update the group name
  await bo.conversations.sync()
  const boGroup = (await bo.conversations.listGroups())[0]
  await boGroup.sync()
  await boGroup.updateName("bo's group")
  await alixGroup.sync()
  name = await alixGroup.name()
  assert(
    name === "bo's group",
    `group name should be bo's group but was ${name}`
  )

  // Now alix removed bo as an admin
  await alixGroup.removeAdmin(bo.inboxId)
  await alix.conversations.sync()
  boIsAdmin = await alixGroup.isAdmin(bo.inboxId)
  assert(!boIsAdmin, `bo should not be an admin`)

  // Bo can no longer update the group name
  try {
    await boGroup.updateName('new name 2')
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected error
  }

  await alixGroup.sync()
  name = await alixGroup.name()
  assert(
    name === "bo's group",
    `group name should be bo's group but was ${name}`
  )

  // throw new Error('Expected exception when non-admin attempts to update group name.')
  return true
})

test('can not remove a super admin from a group', async () => {
  // Create clients
  const [alix, bo] = await createClients(3)

  // Alix Create a group
  const alixGroup = await alix.conversations.newGroup([bo.inboxId], {
    permissionLevel: 'all_members',
  })

  let alixIsSuperAdmin = await alixGroup.isSuperAdmin(alix.inboxId)
  let boIsSuperAdmin = await alixGroup.isSuperAdmin(bo.inboxId)
  let numMembers = (await alixGroup.memberInboxIds()).length
  assert(alixIsSuperAdmin, `alix should be a super admin`)
  assert(!boIsSuperAdmin, `bo should not be a super admin`)
  assert(
    numMembers === 2,
    `number of members should be 2 but was ${numMembers}`
  )

  await bo.conversations.sync()
  const boGroup = (await bo.conversations.listGroups())[0]
  await boGroup.sync()

  // Bo should not be able to remove alix from the group
  try {
    await boGroup.removeMembersByIdentity([alix.publicIdentity])
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  await boGroup.sync()
  numMembers = (await alixGroup.memberInboxIds()).length
  assert(alixIsSuperAdmin, `alix should be a super admin`)
  assert(!boIsSuperAdmin, `bo should not be a super admin`)
  assert(
    numMembers === 2,
    `number of members should be 2 but was ${numMembers}`
  )

  // Alix adds bo as a super admin
  await alixGroup.addSuperAdmin(bo.inboxId)
  await alixGroup.sync()
  boIsSuperAdmin = await alixGroup.isSuperAdmin(bo.inboxId)
  assert(boIsSuperAdmin, `bo should be a super admin`)
  await boGroup.sync()
  boIsSuperAdmin = await boGroup.isSuperAdmin(bo.inboxId)
  assert(boIsSuperAdmin, `bo should be a super admin`)

  // Verify bo can not remove alix bc alix is a super admin
  try {
    await boGroup.removeMembersByIdentity([alix.publicIdentity])
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }
  await boGroup.sync()
  await alixGroup.sync()
  numMembers = (await alixGroup.memberInboxIds()).length
  assert(
    numMembers === 2,
    `number of members should be 2 but was ${numMembers}`
  )

  // Bo can remove alix as a super admin
  await boGroup.sync()
  await boGroup.removeSuperAdmin(alix.inboxId)
  await boGroup.sync()
  await alixGroup.sync()
  alixIsSuperAdmin = await alixGroup.isSuperAdmin(alix.inboxId)
  assert(!alixIsSuperAdmin, `alix should not be a super admin`)

  // Now bo can remove Alix from the group
  await boGroup.removeMembers([alix.inboxId])
  await boGroup.sync()
  numMembers = (await boGroup.memberInboxIds()).length
  assert(
    numMembers === 1,
    `number of members should be 1 but was ${numMembers}`
  )

  return true
})

test('can commit after invalid permissions commit', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  // Bo creates a group with Alix and Caro
  const boGroup = await bo.conversations.newGroup(
    [alix.inboxId, caro.inboxId],
    { permissionLevel: 'all_members' }
  )
  await alix.conversations.sync()
  const alixGroup = (await alix.conversations.listGroups())[0]

  // Verify that Alix cannot add an admin
  assert(
    (await boGroup.name()) === '',
    `boGroup.name should be empty string but was ${boGroup.name}`
  )
  try {
    await alixGroup.addAdmin(alix.inboxId)
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  await alixGroup.sync()
  await boGroup.sync()

  // Verify that Alix can update the group name
  await boGroup.sync()
  await alixGroup.sync()
  await alixGroup.updateName('Alix group name')
  await alixGroup.sync()
  await boGroup.sync()
  assert(
    (await boGroup.name()) === 'Alix group name',
    `boGroup.name should be "Alix group name" but was ${boGroup.name}`
  )
  assert(
    (await alixGroup.name()) === 'Alix group name',
    `alixGroup.name should be "Alix group name" but was ${alixGroup.name}`
  )

  return true
})

test('group with All Members policy has remove function that is admin only', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  // Bo creates a group with Alix and Caro with all_members policy
  const boGroup = await bo.conversations.newGroup(
    [alix.inboxId, caro.inboxId],
    { permissionLevel: 'all_members' }
  )
  await alix.conversations.sync()
  const alixGroup = (await alix.conversations.listGroups())[0]

  // Verify that Alix cannot remove a member
  try {
    await alixGroup.removeMembers([caro.inboxId])
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  // Verify that Bo (admin) can remove a member
  await boGroup.removeMembers([caro.inboxId])
  await boGroup.sync()
  const members = await boGroup.memberInboxIds()
  assert(
    !members.includes(caro.inboxId),
    `Caro should have been removed from the group but is still a member`
  )

  return true
})

test('can update group permissions', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  // Bo creates a group with Alix and Caro
  const boGroup = await bo.conversations.newGroup(
    [alix.inboxId, caro.inboxId],
    { permissionLevel: 'admin_only' }
  )

  // Verify that bo is a super admin
  assert(
    (await boGroup.isSuperAdmin(bo.inboxId)) === true,
    `bo should be a super admin`
  )

  // Verify that group has the expected group description permission
  assert(
    (await boGroup.permissionPolicySet()).updateGroupDescriptionPolicy ===
      'admin',
    `boGroup.permissionPolicySet.updateGroupDescriptionPolicy should be admin but was ${(await boGroup.permissionPolicySet()).updateGroupDescriptionPolicy}`
  )

  // Verify that Bo can update the group description
  await boGroup.updateDescription('new description')
  await boGroup.sync()
  assert(
    (await boGroup.description()) === 'new description',
    `boGroup.description should be "new description" but was ${boGroup.description}`
  )

  // Verify that alix can not update the group description
  await alix.conversations.sync()
  const alixGroup = (await alix.conversations.listGroups())[0]
  try {
    await alixGroup.updateDescription('new description 2')
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  // Verify that alix can not update permissions
  try {
    await alixGroup.updateDescriptionPermission('allow')
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  // Verify that bo can update permissions
  await boGroup.updateDescriptionPermission('allow')
  await boGroup.sync()
  assert(
    (await boGroup.permissionPolicySet()).updateGroupDescriptionPolicy ===
      'allow',
    `boGroup.permissionPolicySet.updateGroupDescriptionPolicy should be allow but was ${(await boGroup.permissionPolicySet()).updateGroupDescriptionPolicy}`
  )

  // Verify that alix can now update the group description
  await alixGroup.updateDescription('new description 2')
  await alixGroup.sync()
  assert(
    (await alixGroup.description()) === 'new description 2',
    `alixGroup.description should be "new description 2" but was ${alixGroup.description}`
  )

  return true
})

test('can create a group with custom permissions', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  const customPermissionsPolicySet: PermissionPolicySet = {
    addMemberPolicy: 'allow',
    removeMemberPolicy: 'deny',
    addAdminPolicy: 'admin',
    removeAdminPolicy: 'superAdmin',
    updateGroupNamePolicy: 'admin',
    updateGroupDescriptionPolicy: 'allow',
    updateGroupImagePolicy: 'admin',
    updateMessageDisappearingPolicy: 'deny',
    updateAppDataPolicy: 'allow',
  }

  // Bo creates a group with Alix and Caro with custom permissions
  await bo.conversations.newGroupCustomPermissions(
    [alix.inboxId, caro.inboxId],
    customPermissionsPolicySet
  )

  // Verify that bo can read the correct permissions
  await alix.conversations.sync()
  const alixGroup = (await alix.conversations.listGroups())[0]
  const permissions = await alixGroup.permissionPolicySet()
  assert(
    permissions.addMemberPolicy === customPermissionsPolicySet.addMemberPolicy,
    `permissions.addMemberPolicy should be ${customPermissionsPolicySet.addMemberPolicy} but was ${permissions.addMemberPolicy}`
  )
  assert(
    permissions.removeMemberPolicy ===
      customPermissionsPolicySet.removeMemberPolicy,
    `permissions.removeMemberPolicy should be ${customPermissionsPolicySet.removeMemberPolicy} but was ${permissions.removeMemberPolicy}`
  )
  assert(
    permissions.addAdminPolicy === customPermissionsPolicySet.addAdminPolicy,
    `permissions.addAdminPolicy should be ${customPermissionsPolicySet.addAdminPolicy} but was ${permissions.addAdminPolicy}`
  )
  assert(
    permissions.removeAdminPolicy ===
      customPermissionsPolicySet.removeAdminPolicy,
    `permissions.removeAdminPolicy should be ${customPermissionsPolicySet.removeAdminPolicy} but was ${permissions.removeAdminPolicy}`
  )
  assert(
    permissions.updateGroupNamePolicy ===
      customPermissionsPolicySet.updateGroupNamePolicy,
    `permissions.updateGroupNamePolicy should be ${customPermissionsPolicySet.updateGroupNamePolicy} but was ${permissions.updateGroupNamePolicy}`
  )
  assert(
    permissions.updateGroupDescriptionPolicy ===
      customPermissionsPolicySet.updateGroupDescriptionPolicy,
    `permissions.updateGroupDescriptionPolicy should be ${customPermissionsPolicySet.updateGroupDescriptionPolicy} but was ${permissions.updateGroupDescriptionPolicy}`
  )
  assert(
    permissions.updateGroupImagePolicy ===
      customPermissionsPolicySet.updateGroupImagePolicy,
    `permissions.updateGroupImagePolicy should be ${customPermissionsPolicySet.updateGroupImagePolicy} but was ${permissions.updateGroupImagePolicy}`
  )

  // Verify that alix can update the group description
  await alixGroup.updateDescription('new description')
  await alixGroup.sync()
  assert(
    (await alixGroup.description()) === 'new description',
    `alixGroup.description should be "new description" but was ${alixGroup.description}`
  )

  // Verify that alix can not update the group name
  try {
    await alixGroup.updateName('new name')
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  return true
})

test('creating a group with invalid permissions should fail', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  // Add/Remove admin can not be set to allow
  const customPermissionsPolicySet: PermissionPolicySet = {
    addMemberPolicy: 'allow',
    removeMemberPolicy: 'deny',
    addAdminPolicy: 'allow',
    removeAdminPolicy: 'superAdmin',
    updateGroupNamePolicy: 'admin',
    updateGroupDescriptionPolicy: 'allow',
    updateGroupImagePolicy: 'admin',
    updateMessageDisappearingPolicy: 'admin',
    updateAppDataPolicy: 'allow',
  }

  // Bo creates a group with Alix and Caro
  try {
    await bo.conversations.newGroupCustomPermissions(
      [alix.inboxId, caro.inboxId],
      customPermissionsPolicySet
    )
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
    console.log('error', error)
    return true
  }
})
