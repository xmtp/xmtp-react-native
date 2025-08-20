export enum CommitLogForkStatus {
  FORKED = 'forked',
  NOT_FORKED = 'notForked',
  UNKNOWN = 'unknown',
}

export class ConversationDebugInfo {
  epoch: number
  maybeForked: boolean
  forkDetails: string
  localCommitLog: string
  remoteCommitLog: string
  commitLogForkStatus: CommitLogForkStatus

  constructor(
    epoch: number,
    maybeForked: boolean,
    forkDetails: string,
    localCommitLog: string,
    remoteCommitLog: string,
    commitLogForkStatus: CommitLogForkStatus
  ) {
    this.epoch = epoch
    this.maybeForked = maybeForked
    this.forkDetails = forkDetails
    this.localCommitLog = localCommitLog
    this.remoteCommitLog = remoteCommitLog
    this.commitLogForkStatus = commitLogForkStatus
  }

  static from(json: string): ConversationDebugInfo {
    const entry = JSON.parse(json)
    return new ConversationDebugInfo(
      entry.epoch,
      entry.maybeForked,
      entry.forkDetails,
      entry.localCommitLog,
      entry.remoteCommitLog,
      entry.commitLogForkStatus
    )
  }
}
