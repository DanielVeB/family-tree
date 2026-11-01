import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildExportFilename,
  serializeTree,
  startTreeDownload,
} from './exportTree'
import { TreeSchema } from '../model/tree'

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
  })

  it('preserves insertion order and includes no additional UI data', () => {
    const serialized = serializeTree({
      version: 1,
      nodes: [
        { id: 'second', data: { firstName: 'Jan' } },
        { id: 'first', data: { firstName: 'Anna' } },
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
