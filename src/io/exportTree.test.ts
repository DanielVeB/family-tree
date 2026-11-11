import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildExportFilename,
  exportWithFileSystemAccess,
  getImportedExportTarget,
  normalizeFileName,
  serializeTree,
  startTreeDownload,
  type SaveFileHandle,
} from './exportTree'
import { TreeSchema } from '../model/tree'
import { parseTreeFile } from './importTree'

describe('normalizeFileName', () => {
  it('keeps Unicode letters and replaces invalid characters with spaces', () => {
    expect(normalizeFileName('Rodzina: Łukasz/Żółtowski?')).toEqual({
      ok: true,
      name: 'Rodzina Łukasz Żółtowski.json',
    })
    expect(normalizeFileName('Łódź\\Test*Name" <1>|2')).toEqual({
      ok: true,
      name: 'Łódź Test Name 1 2.json',
    })
    expect(normalizeFileName('Anna\u0000\tTest')).toEqual({
      ok: true,
      name: 'Anna Test.json',
    })
  })

  it('collapses whitespace, normalizes NFC, strips trailing dots, and avoids a doubled extension', () => {
    expect(normalizeFileName('  Cafe\u0301   test... .JSON  ')).toEqual({
      ok: true,
      name: 'Café test.json',
    })
    expect(normalizeFileName('tree.json')).toEqual({
      ok: true,
      name: 'tree.json',
    })
    expect(normalizeFileName('tree.json.JSON')).toEqual({
      ok: true,
      name: 'tree.json',
    })
  })

  it('rejects empty and overlong names and protects reserved Windows names', () => {
    expect(normalizeFileName(' ... ')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeFileName('a'.repeat(101))).toEqual({
      ok: false,
      reason: 'tooLong',
    })
    expect(normalizeFileName('CON')).toEqual({
      ok: true,
      name: 'CON_.json',
    })
    expect(normalizeFileName('com1.json')).toEqual({
      ok: true,
      name: 'com1_.json',
    })
  })

  it('uses an imported JSON filename only as an unconfirmed suggestion', () => {
    expect(getImportedExportTarget('my-tree.JSON')).toEqual({
      name: 'my-tree.json',
      confirmed: false,
    })
    expect(getImportedExportTarget('family-tree.txt')).toBeNull()
    expect(getImportedExportTarget(`${'x'.repeat(101)}.json`)).toBeNull()
  })
})

describe('exportWithFileSystemAccess', () => {
  function makeHandle(
    name = 'Rodzina Testowa.json',
    permission: PermissionState = 'granted',
  ) {
    const written: string[] = []
    const write = vi.fn(async (text: string) => {
      written.push(text)
    })
    const close = vi.fn(async () => {})
    const handle: SaveFileHandle = {
      name,
      createWritable: async () => ({ write, close }),
      queryPermission: vi.fn(async () => permission),
      requestPermission: vi.fn(async () => permission),
    }
    return { handle, write, close, written }
  }

  const tree = {
    version: 1 as const,
    nodes: [
      {
        id: 'person-1',
        data: { firstName: 'Łucja Żółć' },
        metaData: { layer: 0, order: 0 },
      },
    ],
    edges: [],
  }

  it('opens the picker and writes the serialized UTF-8 content', async () => {
    const text = serializeTree(tree)
    const { handle, write, close, written } = makeHandle()
    const picker = vi.fn(async () => handle)

    const result = await exportWithFileSystemAccess({
      text,
      target: null,
      suggestedName: 'family-tree-2026-11-08.json',
      forcePicker: false,
      pickerType: 'Family tree file',
      showSaveFilePicker: picker,
    })

    expect(picker).toHaveBeenCalledWith({
      suggestedName: 'family-tree-2026-11-08.json',
      types: [
        {
          description: 'Family tree file',
          accept: { 'application/json': ['.json'] },
        },
      ],
    })
    expect(write).toHaveBeenCalledWith(text)
    expect(new TextDecoder().decode(new TextEncoder().encode(written[0]))).toBe(
      text,
    )
    expect(close).toHaveBeenCalledOnce()
    expect(result).toEqual({
      kind: 'exported',
      target: { name: handle.name, handle, confirmed: true },
      updated: false,
    })
  })

  it('overwrites a permitted target and requests permission only when needed', async () => {
    const { handle, write, close } = makeHandle('picked-tree.json', 'prompt')
    const requestPermission = vi
      .fn<() => Promise<PermissionState>>()
      .mockResolvedValue('granted')
    handle.queryPermission = vi.fn(
      async (): Promise<PermissionState> => 'prompt',
    )
    handle.requestPermission = requestPermission
    const picker = vi.fn()

    const result = await exportWithFileSystemAccess({
      text: '{"version":1}\n',
      target: { name: 'old-name.json', handle, confirmed: true },
      suggestedName: 'ignored.json',
      forcePicker: false,
      pickerType: 'Family tree file',
      showSaveFilePicker: picker,
    })

    expect(handle.queryPermission).toHaveBeenCalledWith({
      mode: 'readwrite',
    })
    expect(requestPermission).toHaveBeenCalledOnce()
    expect(picker).not.toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith('{"version":1}\n')
    expect(close).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      kind: 'exported',
      target: { name: 'picked-tree.json' },
      updated: true,
    })
  })

  it('returns a silent result when the native picker is cancelled', async () => {
    const picker = vi.fn(async () => {
      throw Object.assign(new Error('cancelled'), { name: 'AbortError' })
    })
    await expect(
      exportWithFileSystemAccess({
        text: '{}',
        target: null,
        suggestedName: 'tree.json',
        forcePicker: false,
        pickerType: 'Family tree file',
        showSaveFilePicker: picker,
      }),
    ).resolves.toEqual({ kind: 'cancelled' })
  })

  it('forgets a denied target and surfaces only the error name', async () => {
    const { handle } = makeHandle('tree.json', 'denied')
    await expect(
      exportWithFileSystemAccess({
        text: '{}',
        target: { name: 'tree.json', handle, confirmed: true },
        suggestedName: 'tree.json',
        forcePicker: false,
        pickerType: 'Family tree file',
        showSaveFilePicker: vi.fn(),
      }),
    ).rejects.toMatchObject({
      errorName: 'NotAllowedError',
      forgetHandle: true,
    })
    expect(handle.requestPermission).toHaveBeenCalledOnce()
  })

  it('forgets an existing handle after a write failure', async () => {
    const handle: SaveFileHandle = {
      name: 'tree.json',
      queryPermission: async () => 'granted',
      createWritable: async () => ({
        write: async () => {
          throw Object.assign(new Error(), { name: 'NotReadableError' })
        },
        close: async () => {},
      }),
    }

    await expect(
      exportWithFileSystemAccess({
        text: '{}',
        target: { name: handle.name, handle, confirmed: true },
        suggestedName: 'tree.json',
        forcePicker: false,
        pickerType: 'Family tree file',
        showSaveFilePicker: vi.fn(),
      }),
    ).rejects.toMatchObject({
      errorName: 'NotReadableError',
      forgetHandle: true,
    })
  })

  it('exports, imports, and exports byte-identically', async () => {
    const first = serializeTree(tree)
    const parsed = parseTreeFile(first)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(serializeTree(parsed.tree)).toBe(first)
    expect(new TextEncoder().encode(serializeTree(parsed.tree))).toEqual(
      new TextEncoder().encode(first),
    )
  })

  it('round-trips optional details in key order with unknown data preserved', () => {
    const detailedTree = {
      version: 1 as const,
      nodes: [
        {
          id: 'person-anna',
          data: {
            futureField: 'kept',
            dateOfBirth: '1948-03-07',
            gender: 'female' as const,
            firstName: 'Anna',
            lastName: 'Testowa',
          },
          metaData: { layer: 0, order: 0 },
        },
        {
          id: 'person-jan',
          data: {
            firstName: 'Jan',
            dateOfDeath: '2019',
            custom: { value: 1 },
          },
          metaData: { layer: 0, order: 1 },
        },
      ],
      edges: [
        { from: 'person-anna', to: 'person-jan', type: 'marriage' as const },
      ],
    }
    const first = serializeTree(detailedTree)
    const exportedData = (
      JSON.parse(first) as {
        nodes: Array<{ data: Record<string, unknown> }>
      }
    ).nodes[0]!.data
    expect(Object.keys(exportedData)).toEqual([
      'firstName',
      'lastName',
      'gender',
      'dateOfBirth',
      'futureField',
    ])
    expect(first.indexOf('"gender"')).toBeLessThan(
      first.indexOf('"dateOfBirth"'),
    )
    expect(first.indexOf('"dateOfBirth"')).toBeLessThan(
      first.indexOf('"futureField"'),
    )
    const parsed = parseTreeFile(first)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(serializeTree(parsed.tree)).toBe(first)
    expect(parsed.tree.nodes[0]!.data.futureField).toBe('kept')
    expect(parsed.tree.nodes[1]!.data.custom).toEqual({ value: 1 })
  })
})

describe('serializeTree', () => {
  const tree = {
    version: 1 as const,
    nodes: [
      {
        id: 'person-1',
        data: {
          firstName: 'Łukasz',
          lastName: 'Żółtowski',
          futureField: { note: 'Zażółć gęślą jaźń 🧡' },
        },
        metaData: { layer: 0, order: 0 },
      },
    ],
    edges: [],
    futureMetadata: 'preserved',
  }

  it('outputs deterministic, readable UTF-8 JSON with a trailing newline', () => {
    const serialized = serializeTree(tree)
    expect(serialized).toBe(serializeTree(tree))
    expect(serialized.endsWith('\n')).toBe(true)
    expect(serialized).toContain('  "version": 1')
    expect(serialized).toContain('Łukasz')
    expect(serialized).toContain('Żółtowski')
    expect(serialized).toContain('🧡')
    expect(serialized).not.toContain('\\u0141')
    expect(JSON.parse(serialized)).toEqual(tree)
    expect(TreeSchema.parse(JSON.parse(serialized))).toEqual(tree)
    expect(Object.keys(JSON.parse(serialized).nodes[0]!)).toEqual([
      'id',
      'data',
      'metaData',
    ])
    expect(Object.keys(JSON.parse(serialized).nodes[0]!.metaData)).toEqual([
      'layer',
      'order',
    ])
  })

  it('preserves insertion order and includes no additional UI data', () => {
    const serialized = serializeTree({
      version: 1,
      nodes: [
        {
          id: 'second',
          data: { firstName: 'Jan' },
          metaData: { layer: 0, order: 0 },
        },
        {
          id: 'first',
          data: { firstName: 'Anna' },
          metaData: { layer: 0, order: 1 },
        },
      ],
      edges: [{ from: 'second', to: 'first', type: 'child' }],
    })
    expect(serialized.indexOf('"second"')).toBeLessThan(
      serialized.indexOf('"first"'),
    )
    expect(serialized).not.toContain('selectedId')
    expect(serialized).not.toContain('revision')
  })

  it('rejects invalid data before serialization', () => {
    expect(() =>
      serializeTree({
        version: 1,
        nodes: [],
        edges: [{ from: 'missing', to: 'also-missing', type: 'child' }],
      } as never),
    ).toThrow()
  })
})

describe('buildExportFilename', () => {
  it('uses the supplied date in local calendar time', () => {
    expect(buildExportFilename(new Date(2026, 10, 1, 23, 59))).toBe(
      'family-tree-2026-11-01.json',
    )
    expect(buildExportFilename(new Date(2026, 11, 31, 23, 59))).toBe(
      'family-tree-2026-12-31.json',
    )
    expect(buildExportFilename(new Date(2027, 0, 1, 0, 1))).toBe(
      'family-tree-2027-01-01.json',
    )
  })
})

describe('startTreeDownload', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('clicks a temporary download link and revokes its object URL later', () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn((blob: Blob) => {
      expect(blob).toBeInstanceOf(Blob)
      return 'blob:family-tree'
    })
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    startTreeDownload('{"version":1}\n', 'family-tree-2026-11-01.json')

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(createObjectURL.mock.calls[0]![0].type).toBe(
      'application/json;charset=utf-8',
    )
    expect(click).toHaveBeenCalledOnce()
    expect(click.mock.contexts[0]).toMatchObject({
      download: 'family-tree-2026-11-01.json',
      href: 'blob:family-tree',
    })
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revokeObjectURL).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:family-tree')
  })

  it('removes temporary elements and revokes the URL if download fails', () => {
    const createObjectURL = vi.fn((blob: Blob) => {
      expect(blob).toBeInstanceOf(Blob)
      return 'blob:family-tree'
    })
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('simulated browser failure')
    })

    expect(() =>
      startTreeDownload('{}', 'family-tree-2026-11-01.json'),
    ).toThrow('simulated browser failure')
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:family-tree')
  })
})
