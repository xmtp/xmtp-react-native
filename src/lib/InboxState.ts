import { Address, InboxId } from './Client'

export class InboxState {
  inboxId: InboxId
  addresses: Address[]
  installations: Installation[]
  recoveryAddress: Address

  constructor(
    inboxId: InboxId,
    addresses: Address[],
    installations: Installation[],
    recoveryAddress: Address
  ) {
    this.inboxId = inboxId
    this.addresses = addresses
    this.installations = installations
    this.recoveryAddress = recoveryAddress
  }

  static from(json: string): InboxState {
    const entry = JSON.parse(json)
    return new InboxState(
      entry.inboxId,
      entry.addresses,
      entry.installations.map((inst: string) => {
        return Installation.from(inst)
      }),
      entry.recoveryAddress
    )
  }
}

export class Installation {
  id: string
  createdAt: number | undefined // timestamp in milliseconds

  constructor(id: string, createdAt: number) {
    this.id = id
    this.createdAt = createdAt
  }

  static from(json: string): Installation {
    const installation = JSON.parse(json)
    return new Installation(installation.id, installation.createdAt)
  }
}
