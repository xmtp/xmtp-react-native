export type PermissionOption =
  | 'allow'
  | 'deny'
  | 'admin'
  | 'superAdmin'
  | 'unknown'

export type PermissionPolicySet = {
  addMemberPolicy: PermissionOption
  removeMemberPolicy: PermissionOption
  addAdminPolicy: PermissionOption
  removeAdminPolicy: PermissionOption
  updateGroupNamePolicy: PermissionOption
  updateGroupDescriptionPolicy: PermissionOption
  updateGroupImagePolicy: PermissionOption
}
