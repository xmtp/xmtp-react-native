export type PermissionOption =
  | 'allow' // Any members of the group can perform this action
  | 'deny' // No members of the group can perform this action
  | 'admin' // Only admins or super admins of the group can perform this action
  | 'superAdmin' // Only the super admin of the group can perform this action
  | 'unknown'

// Add Admin and Remove admin must be set to either 'admin', 'superAdmin' or 'deny' to be valid
export type PermissionPolicySet = {
  addMemberPolicy: PermissionOption
  removeMemberPolicy: PermissionOption
  addAdminPolicy: PermissionOption
  removeAdminPolicy: PermissionOption
  updateGroupNamePolicy: PermissionOption
  updateGroupDescriptionPolicy: PermissionOption
  updateGroupImagePolicy: PermissionOption
  updateGroupPinnedFrameUrlPolicy: PermissionOption
}
