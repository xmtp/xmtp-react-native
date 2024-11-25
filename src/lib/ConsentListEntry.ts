export type ConsentState = 'allowed' | 'denied' | 'unknown'

export type ConsentType = 'address' | 'conversation_id' | 'inbox_id'

export class ConsentRecord {
  value: string
  entryType: ConsentType
  permissionType: ConsentState

  constructor(
    value: string,
    entryType: ConsentType,
    permissionType: ConsentState
  ) {
    this.value = value
    this.entryType = entryType
    this.permissionType = permissionType
  }

  static from(json: string): ConsentRecord {
    const entry = JSON.parse(json)
    return new ConsentRecord(entry.value, entry.type, entry.state)
  }
}
