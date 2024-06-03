export class Member {
  inboxId: string
  addresses: string[]
  permissionLevel: 'member' | 'admin' | 'super_admin'

  constructor(
    inboxId: string,
    addresses: string[],
    permissionLevel: 'member' | 'admin' | 'super_admin'
  ) {
    this.inboxId = inboxId
    this.addresses = addresses
    this.permissionLevel = permissionLevel
  }

  static from(json: string): Member {
    const entry = JSON.parse(json)
    return new Member(entry.inboxId, entry.addresses, entry.permissionLevel)
  }
}
