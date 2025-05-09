export class ConversationDebugInfo {
  epoch: number
  maybeForked: boolean
  forkDetails: string

  constructor(epoch: number, maybeForked: boolean, forkDetails: string) {
    this.epoch = epoch
    this.maybeForked = maybeForked
    this.forkDetails = forkDetails
  }

  static from(json: string): ConversationDebugInfo {
    const entry = JSON.parse(json)
    return new ConversationDebugInfo(
      entry.epoch,
      entry.maybeForked,
      entry.forkDetails
    )
  }
}
