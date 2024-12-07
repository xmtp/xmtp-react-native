import { Address, InboxId } from './Client'
import { ConsentState } from './ConsentRecord'

export type PermissionLevel = 'member' | 'admin' | 'super_admin'

export class Member {
  inboxId: InboxId
  addresses: Address[]
  permissionLevel: PermissionLevel
  consentState: ConsentState

  constructor(
    inboxId: InboxId,
    addresses: Address[],
    permissionLevel: PermissionLevel,
    consentState: ConsentState
  ) {
    this.inboxId = inboxId
    this.addresses = addresses
    this.permissionLevel = permissionLevel
    this.consentState = consentState
  }

  static from(json: string): Member {
    const entry = JSON.parse(json)
    return new Member(
      entry.inboxId,
      entry.addresses,
      entry.permissionLevel,
      entry.consentState
    )
  }
}
