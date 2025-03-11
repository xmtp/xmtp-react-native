import { InboxId } from './Client'
import { ConsentState } from './ConsentRecord'
import { PublicIdentity } from './PublicIdentity'

export type PermissionLevel = 'member' | 'admin' | 'super_admin'

export class Member {
  inboxId: InboxId
  identities: PublicIdentity[]
  permissionLevel: PermissionLevel
  consentState: ConsentState

  constructor(
    inboxId: InboxId,
    identities: PublicIdentity[],
    permissionLevel: PermissionLevel,
    consentState: ConsentState
  ) {
    this.inboxId = inboxId
    this.identities = identities
    this.permissionLevel = permissionLevel
    this.consentState = consentState
  }

  static from(json: string): Member {
    const entry = JSON.parse(json)
    return new Member(
      entry.inboxId,
      entry.identities.map((id: string) => {
        return PublicIdentity.from(id)
      }),
      entry.permissionLevel,
      entry.consentState
    )
  }
}
