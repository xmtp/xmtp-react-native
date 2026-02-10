export type ArchiveElement = 'messages' | 'consent'

export class ArchiveOptions {
  startNs?: number
  endNs?: number
  archiveElements?: ArchiveElement[]
  excludeDisappearingMessages?: boolean

  constructor(
    archiveElements?: ArchiveElement[],
    startNs?: number,
    endNs?: number,
    excludeDisappearingMessages?: boolean
  ) {
    this.archiveElements = archiveElements
    this.startNs = startNs
    this.endNs = endNs
    this.excludeDisappearingMessages = excludeDisappearingMessages
  }
}

export class ArchiveMetadata {
  archiveVersion: number
  elements: ArchiveElement[]
  exportedAtNs: number
  startNs?: number
  endNs?: number

  constructor(json: string) {
    const ffi = JSON.parse(json)

    this.archiveVersion = ffi.backupVersion
    this.elements = ffi.elements
    this.exportedAtNs = ffi.exportedAtNs
    this.startNs = ffi.startNs ?? undefined
    this.endNs = ffi.endNs ?? undefined
  }
}
