export type ArchiveElement = 'messages' | 'consent'

export class ArchiveOptions {
  startNs?: number
  endNs?: number
  archiveElements?: ArchiveElement[]

  constructor(
    archiveElements?: ArchiveElement[],
    startNs?: number,
    endNs?: number
  ) {
    this.archiveElements = archiveElements
    this.startNs = startNs
    this.endNs = endNs
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
