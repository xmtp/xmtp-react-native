export type ConsentState = 'allowed' | 'denied' | 'unknown'

export type ConsentType = 'conversation_id' | 'inbox_id'

export class ConsentRecord {
  value: string
  entryType: ConsentType
  state: ConsentState

  constructor(value: string, entryType: ConsentType, state: ConsentState) {
    this.value = value
    this.entryType = entryType
    this.state = state
  }

  static from(json: string): ConsentRecord {
    const entry = JSON.parse(json)
    return new ConsentRecord(entry.value, entry.type, entry.state)
  }
}
