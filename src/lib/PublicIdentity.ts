export type PublicIdentityKind = 'ETHEREUM' | 'PASSKEY'

export class PublicIdentity {
  identifier: string
  kind: PublicIdentityKind

  constructor(identifier: string, kind: PublicIdentityKind) {
    this.identifier = identifier
    this.kind = kind
  }

  static from(json: string): PublicIdentity {
    const identity = JSON.parse(json)
    return new PublicIdentity(identity.identifier, identity.kind)
  }
}
