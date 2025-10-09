import { InboxId } from './Client'
import { PublicIdentity } from './PublicIdentity'

type SignatureKind =
  | 'ERC191'
  | 'ERC1271'
  | 'INSTALLATION_KEY'
  | 'LEGACY_DELEGATED'
  | 'P256'

export class InboxState {
  inboxId: InboxId
  identities: PublicIdentity[]
  installations: Installation[]
  recoveryIdentity: PublicIdentity
  creationSignatureKind?: SignatureKind

  constructor(
    inboxId: InboxId,
    identities: PublicIdentity[],
    installations: Installation[],
    recoveryIdentity: PublicIdentity,
    creationSignatureKind?: SignatureKind
  ) {
    this.inboxId = inboxId
    this.identities = identities
    this.installations = installations
    this.recoveryIdentity = recoveryIdentity
    this.creationSignatureKind = creationSignatureKind
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
      PublicIdentity.from(entry.recoveryIdentity),
      entry.creationSignatureKind?.length
        ? entry.creationSignatureKind
        : undefined
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
