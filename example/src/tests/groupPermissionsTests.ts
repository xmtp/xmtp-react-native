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
  const alixGroup = await alix.conversations.newGroup([bo.address])

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
  await bo.conversations.syncConversations()
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
  await alix.conversations.syncConversations()
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
    { permissionLevel: 'admin_only' }
  )

  if ((await alixGroup.permissionPolicySet()).addMemberPolicy !== 'admin') {
    throw Error(
      `Group add member policy should be admin but was ${(await alixGroup.permissionPolicySet()).addMemberPolicy}`
    )
  }

  // Verify group name is empty string
  const groupName = await alixGroup.groupName()
  assert(
    groupName === '',
    `group name should be empty string but was ${groupName}`
  )

  // Verify that bo can not update the group name
  await bo.conversations.syncConversations()
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
  let groupName = await alixGroup.groupName()
  assert(
    groupName === '',
    `group name should be empty string but was ${groupName}`
  )

  // Verify that bo can not update the group name
  await bo.conversations.syncConversations()
  const boGroup = (await bo.conversations.listGroups())[0]
  try {
    await boGroup.updateGroupName("bo's group")
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  // Alix adds bo as an admin
  await alixGroup.addAdmin(bo.inboxId)
  await alix.conversations.syncConversations()
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
  let groupName = await alixGroup.groupName()
  assert(
    groupName === '',
    `group name should be empty string but was ${groupName}`
  )

  // Alix adds bo as an admin
  await alixGroup.addAdmin(bo.inboxId)
  await alix.conversations.syncConversations()
  let boIsAdmin = await alixGroup.isAdmin(bo.inboxId)
  assert(boIsAdmin, `bo should be an admin`)

  // Now bo can update the group name
  await bo.conversations.syncConversations()
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
  await alix.conversations.syncConversations()
  boIsAdmin = await alixGroup.isAdmin(bo.inboxId)
  assert(!boIsAdmin, `bo should not be an admin`)

  // Bo can no longer update the group name
  try {
    await boGroup.updateGroupName('new name 2')
    return false
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

test('can not remove a super admin from a group', async () => {
  // Create clients
  const [alix, bo] = await createClients(3)

  // Alix Create a group
  const alixGroup = await alix.conversations.newGroup([bo.address], {
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

  await bo.conversations.syncConversations()
  const boGroup = (await bo.conversations.listGroups())[0]
  await boGroup.sync()

  // Bo should not be able to remove alix from the group
  try {
    await boGroup.removeMembersByInboxId([alix.inboxId])
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
    await boGroup.removeMembersByInboxId([alix.inboxId])
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
  await boGroup.removeMembers([alix.address])
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
    [alix.address, caro.address],
    { permissionLevel: 'all_members' }
  )
  await alix.conversations.syncConversations()
  const alixGroup = (await alix.conversations.listGroups())[0]

  // Verify that Alix cannot add an admin
  assert(
    (await boGroup.groupName()) === '',
    `boGroup.groupName should be empty string but was ${boGroup.groupName}`
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
  await alixGroup.updateGroupName('Alix group name')
  await alixGroup.sync()
  await boGroup.sync()
  assert(
    (await boGroup.groupName()) === 'Alix group name',
    `boGroup.groupName should be "Alix group name" but was ${boGroup.groupName}`
  )
  assert(
    (await alixGroup.groupName()) === 'Alix group name',
    `alixGroup.groupName should be "Alix group name" but was ${alixGroup.groupName}`
  )

  return true
})

test('group with All Members policy has remove function that is admin only', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  // Bo creates a group with Alix and Caro with all_members policy
  const boGroup = await bo.conversations.newGroup(
    [alix.address, caro.address],
    { permissionLevel: 'all_members' }
  )
  await alix.conversations.syncConversations()
  const alixGroup = (await alix.conversations.listGroups())[0]

  // Verify that Alix cannot remove a member
  try {
    await alixGroup.removeMembers([caro.address])
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  // Verify that Bo (admin) can remove a member
  await boGroup.removeMembers([caro.address])
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
    [alix.address, caro.address],
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
  await boGroup.updateGroupDescription('new description')
  await boGroup.sync()
  assert(
    (await boGroup.groupDescription()) === 'new description',
    `boGroup.groupDescription should be "new description" but was ${boGroup.groupDescription}`
  )

  // Verify that alix can not update the group description
  await alix.conversations.syncConversations()
  const alixGroup = (await alix.conversations.listGroups())[0]
  try {
    await alixGroup.updateGroupDescription('new description 2')
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  // Verify that alix can not update permissions
  try {
    await alixGroup.updateGroupDescriptionPermission('allow')
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  // Verify that bo can update permissions
  await boGroup.updateGroupDescriptionPermission('allow')
  await boGroup.sync()
  assert(
    (await boGroup.permissionPolicySet()).updateGroupDescriptionPolicy ===
      'allow',
    `boGroup.permissionPolicySet.updateGroupDescriptionPolicy should be allow but was ${(await boGroup.permissionPolicySet()).updateGroupDescriptionPolicy}`
  )

  // Verify that alix can now update the group description
  await alixGroup.updateGroupDescription('new description 2')
  await alixGroup.sync()
  assert(
    (await alixGroup.groupDescription()) === 'new description 2',
    `alixGroup.groupDescription should be "new description 2" but was ${alixGroup.groupDescription}`
  )

  return true
})

test('can update group pinned frame', async () => {
  // Create clients
  const [alix, bo, caro] = await createClients(3)

  // Bo creates a group with Alix and Caro
  const boGroup = await bo.conversations.newGroup(
    [alix.address, caro.address],
    { permissionLevel: 'admin_only' }
  )

  // Verify that alix can not update the group pinned frame
  await alix.conversations.syncConversations()
  const alixGroup = (await alix.conversations.listGroups())[0]
  try {
    await alixGroup.updateGroupPinnedFrameUrl('new pinned frame')
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  // Verify that bo can update the group pinned frame
  await boGroup.updateGroupPinnedFrameUrl('new pinned frame 2')
  await boGroup.sync()
  assert(
    (await boGroup.groupPinnedFrameUrl()) === 'new pinned frame 2',
    `boGroup.groupPinnedFrameUrl should be "new pinned frame 2" but was ${boGroup.groupPinnedFrameUrl}`
  )

  // Verify that bo can update the pinned frame permission
  await boGroup.updateGroupPinnedFrameUrlPermission('allow')
  await boGroup.sync()
  assert(
    (await boGroup.permissionPolicySet()).updateGroupPinnedFrameUrlPolicy ===
      'allow',
    `boGroup.permissionPolicySet.updateGroupPinnedFrameUrlPolicy should be allow but was ${(await boGroup.permissionPolicySet()).updateGroupPinnedFrameUrlPolicy}`
  )

  // Verify that Alix can now update pinned frames
  await alixGroup.updateGroupPinnedFrameUrl('new pinned frame 3')
  await alixGroup.sync()
  await boGroup.sync()
  assert(
    (await boGroup.groupPinnedFrameUrl()) === 'new pinned frame 3',
    `alixGroup.groupPinnedFrameUrl should be "new pinned frame 3" but was ${boGroup.groupPinnedFrameUrl}`
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
    updateGroupPinnedFrameUrlPolicy: 'deny',
  }

  // Bo creates a group with Alix and Caro with custom permissions
  const boGroup = await bo.conversations.newGroupCustomPermissions(
    [alix.address, caro.address],
    customPermissionsPolicySet
  )

  // Verify that bo can read the correct permissions
  await alix.conversations.syncConversations()
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
  assert(
    permissions.updateGroupPinnedFrameUrlPolicy ===
      customPermissionsPolicySet.updateGroupPinnedFrameUrlPolicy,
    `permissions.updateGroupPinnedFrameUrlPolicy should be ${customPermissionsPolicySet.updateGroupPinnedFrameUrlPolicy} but was ${permissions.updateGroupPinnedFrameUrlPolicy}`
  )

  // Verify that bo can not update the pinned frame even though they are a super admin
  try {
    await boGroup.updateGroupPinnedFrameUrl('new pinned frame')
    return false
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // expected
  }

  // Verify that alix can update the group description
  await alixGroup.updateGroupDescription('new description')
  await alixGroup.sync()
  assert(
    (await alixGroup.groupDescription()) === 'new description',
    `alixGroup.groupDescription should be "new description" but was ${alixGroup.groupDescription}`
  )

  // Verify that alix can not update the group name
  try {
    await alixGroup.updateGroupName('new name')
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
    updateGroupPinnedFrameUrlPolicy: 'deny',
  }

  // Bo creates a group with Alix and Caro
  try {
    await bo.conversations.newGroupCustomPermissions(
      [alix.address, caro.address],
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
