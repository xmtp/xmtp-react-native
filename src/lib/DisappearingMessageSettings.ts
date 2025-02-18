export class DisappearingMessageSettings {
  disappearStartingAtNs: number
  retentionDurationInNs: number

  constructor(disappearStartingAtNs: number, retentionDurationInNs: number) {
    this.disappearStartingAtNs = disappearStartingAtNs
    this.retentionDurationInNs = retentionDurationInNs
  }

  static from(json: string): DisappearingMessageSettings {
    const entry = JSON.parse(json)
    return new DisappearingMessageSettings(
      entry.disappearStartingAtNs,
      entry.retentionDurationInNs
    )
  }
}
