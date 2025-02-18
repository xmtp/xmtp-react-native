import { DisappearingMessageSettings } from '../DisappearingMessageSettings'

export type CreateGroupOptions = {
  permissionLevel?: 'all_members' | 'admin_only' | undefined
  name?: string | undefined
  imageUrlSquare?: string | undefined
  description?: string | undefined
  disappearingMessageSettings?: DisappearingMessageSettings | undefined
}
