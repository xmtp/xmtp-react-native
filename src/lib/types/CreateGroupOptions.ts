export type CreateGroupOptions = {
  permissionLevel?: 'all_members' | 'admin_only' | undefined
  name?: string | undefined
  imageUrlSquare?: string | undefined
  description?: string | undefined
  disappearingMessageSettings?: DisappearingMessageSettings | undefined
}

export type DisappearingMessageSettings = {
  disappearStartingAtNs: number
  retentionDurationInNs: number
}
