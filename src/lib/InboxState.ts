import { InboxId } from './Client'

export class InboxState {
  inboxId: InboxId
  addresses: string[]
  installationIds: string[]
  recoveryAddress: string

  constructor(
    inboxId: InboxId,
    addresses: string[],
    installationIds: string[],
    recoveryAddress: string
  ) {
    this.inboxId = inboxId
    this.addresses = addresses
    this.installationIds = installationIds
    this.recoveryAddress = recoveryAddress
  }

  static from(json: string): InboxState {
    const entry = JSON.parse(json)
    return new InboxState(
      entry.inboxId,
      entry.addresses,
      entry.installationIds,
      entry.recoveryAddress
    )
  }
}
