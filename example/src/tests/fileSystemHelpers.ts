import * as FileSystem from 'expo-file-system'

const FILE_SCHEME = 'file://'

function ensureDocumentDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('FileSystem.documentDirectory is unavailable')
  }
  return FileSystem.documentDirectory
}

function stripTrailingSlash(path: string): string {
  return path.endsWith('/') ? path.slice(0, -1) : path
}

function toPath(uri: string): string {
  return uri.startsWith(FILE_SCHEME) ? uri.slice(FILE_SCHEME.length) : uri
}

function toUri(path: string): string {
  return path.startsWith(FILE_SCHEME) ? path : `${FILE_SCHEME}${path}`
}

export function documentDirectoryPath(): string {
  const uri = ensureDocumentDirectory()
  return stripTrailingSlash(toPath(uri))
}

export async function pathExists(path: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(toUri(path))
  return info.exists
}

export async function ensureDirectory(path: string): Promise<void> {
  const uri = toUri(path)
  const info = await FileSystem.getInfoAsync(uri)
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true })
  }
}

export function joinDocumentPath(relative: string): string {
  const base = documentDirectoryPath()
  return `${base}/${relative}`
}
