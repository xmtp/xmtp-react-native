import { InboxId } from './Client'
import { PublicIdentity } from './PublicIdentity'

export class InboxState {
  inboxId: InboxId
  identities: PublicIdentity[]
  installations: Installation[]
  recoveryIdentity: PublicIdentity

  constructor(
    inboxId: InboxId,
    identities: PublicIdentity[],
    installations: Installation[],
    recoveryIdentity: PublicIdentity
  ) {
    this.inboxId = inboxId
    this.identities = identities
    this.installations = installations
    this.recoveryIdentity = recoveryIdentity
  }

  static from(json: string): InboxState {
    const entry = JSON.parse(json)
    return new InboxState(
      entry.inboxId,
      entry.identities.map((id: string) => {
        return PublicIdentity.from(id)
      }),
      entry.installations.map((inst: string) => {
        return Installation.from(inst)
      }),
      PublicIdentity.from(entry.recoveryIdentity)
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
