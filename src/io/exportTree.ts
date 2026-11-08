import { TreeSchema, type FamilyTree } from '../model/tree'

export function serializeTree(tree: FamilyTree): string {
  const validatedTree = TreeSchema.parse(tree)
  return `${JSON.stringify(validatedTree, null, 2)}\n`
}

export function buildExportFilename(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `family-tree-${year}-${month}-${day}.json`
}

export type NormalizedFileName =
  { ok: true; name: string } | { ok: false; reason: 'empty' | 'tooLong' }

export function normalizeFileName(input: string): NormalizedFileName {
  const cleaned = input
    .normalize('NFC')
    .trim()
    .replace(/(?:\.json)+$/i, '')
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/\.+$/u, '')
    .trim()

  if (!cleaned) return { ok: false, reason: 'empty' }
  if ([...cleaned].length > 100) return { ok: false, reason: 'tooLong' }

  const safeName = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/iu.test(cleaned)
    ? `${cleaned}_`
    : cleaned

  return { ok: true, name: `${safeName}.json` }
}

export function getImportedExportTarget(fileName: string): ExportTarget | null {
  if (!/\.json$/i.test(fileName)) return null
  const result = normalizeFileName(fileName)
  return result.ok ? { name: result.name, confirmed: false } : null
}

export interface WritableFile {
  write(data: string): Promise<void>
  close(): Promise<void>
}

export interface SaveFileHandle {
  readonly name: string
  createWritable(): Promise<WritableFile>
  queryPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(descriptor: {
    mode: 'readwrite'
  }): Promise<PermissionState>
}

export interface ExportTarget {
  name: string
  handle?: SaveFileHandle
  confirmed: boolean
}

export interface SaveFilePickerOptions {
  suggestedName: string
  types: {
    description: string
    accept: { 'application/json': ['.json'] }
  }[]
}

export type SaveFilePicker = (
  options: SaveFilePickerOptions,
) => Promise<SaveFileHandle>

export class FileExportError extends Error {
  constructor(
    readonly errorName: string,
    readonly forgetHandle: boolean,
  ) {
    super(errorName)
    this.name = 'FileExportError'
  }
}

export type FileSystemExportResult =
  | { kind: 'cancelled' }
  | { kind: 'exported'; target: ExportTarget; updated: boolean }

export async function exportWithFileSystemAccess({
  text,
  target,
  suggestedName,
  forcePicker,
  pickerType,
  showSaveFilePicker,
}: {
  text: string
  target: ExportTarget | null
  suggestedName: string
  forcePicker: boolean
  pickerType: string
  showSaveFilePicker: SaveFilePicker
}): Promise<FileSystemExportResult> {
  if (target?.handle && !forcePicker) {
    const handle = target.handle
    try {
      let permission = await handle.queryPermission?.({ mode: 'readwrite' })
      if (permission !== 'granted') {
        permission = await handle.requestPermission?.({ mode: 'readwrite' })
      }
      if (permission !== 'granted') {
        throw Object.assign(new Error(), { name: 'NotAllowedError' })
      }
      await writeFile(handle, text)
      return {
        kind: 'exported',
        target: { name: handle.name, handle, confirmed: true },
        updated: true,
      }
    } catch (error) {
      throw new FileExportError(getErrorName(error), true)
    }
  }

  let handle: SaveFileHandle
  try {
    handle = await showSaveFilePicker({
      suggestedName,
      types: [
        { description: pickerType, accept: { 'application/json': ['.json'] } },
      ],
    })
  } catch (error) {
    if (getErrorName(error) === 'AbortError') return { kind: 'cancelled' }
    throw new FileExportError(getErrorName(error), false)
  }

  try {
    await writeFile(handle, text)
  } catch (error) {
    throw new FileExportError(getErrorName(error), false)
  }
  return {
    kind: 'exported',
    target: { name: handle.name, handle, confirmed: true },
    updated: false,
  }
}

export function getBrowserSaveFilePicker(): SaveFilePicker | undefined {
  const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker })
    .showSaveFilePicker
  return typeof picker === 'function' ? picker.bind(window) : undefined
}

async function writeFile(handle: SaveFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(text)
  await writable.close()
}

function getErrorName(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof error.name === 'string'
  ) {
    return error.name
  }
  return 'UnknownError'
}

export function startTreeDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  try {
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 300)
  } catch (error) {
    link.remove()
    URL.revokeObjectURL(url)
    throw error
  }
}
