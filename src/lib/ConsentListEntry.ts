export type ConsentState = 'allowed' | 'denied' | 'unknown'

export type ConsentListEntryType = 'address' | 'group_id' | 'inbox_id'

export class ConsentListEntry {
  value: string
  entryType: ConsentListEntryType
  permissionType: ConsentState

  constructor(
    value: string,
    entryType: ConsentListEntryType,
    permissionType: ConsentState
  ) {
    this.value = value
    this.entryType = entryType
    this.permissionType = permissionType
  }

  static from(json: string): ConsentListEntry {
    const entry = JSON.parse(json)
    return new ConsentListEntry(entry.value, entry.type, entry.state)
  }
}
