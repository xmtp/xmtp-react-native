import { InboxId, InstallationId } from './Client'
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

export class MembershipResult {
  addedMembers: InboxId[]
  removedMembers: InboxId[]
  failedInstallationIds: InstallationId[]

  constructor(
    addedMembers: InboxId[],
    removedMembers: InboxId[],
    failedInstallationIds: InstallationId[]
  ) {
    this.addedMembers = addedMembers
    this.removedMembers = removedMembers
    this.failedInstallationIds = failedInstallationIds
  }

  static from(json: string): MembershipResult {
    const result = JSON.parse(json)
    return new MembershipResult(
      result.addedMembers,
      result.removeMembers,
      result.failedInstallationIds
    )
  }
}
