import { describe, expect, it } from 'vitest'
import { serializeTree } from './exportTree'
import { parseTreeFile } from './importTree'
import validTreeFile from './fixtures/valid-tree.json?raw'
import unknownFieldsFile from './fixtures/unknown-fields.json?raw'
import emptyNodesFile from './fixtures/empty-nodes.json?raw'
import emptyFile from './fixtures/empty.json?raw'
import nonJsonFile from './fixtures/non-json.json?raw'
import wrongShapeFile from './fixtures/wrong-shape.json?raw'
import wrongVersionFile from './fixtures/wrong-version.json?raw'

describe('parseTreeFile', () => {
  it('round-trips an exported file byte-for-byte, including Polish names', () => {
    const parsed = parseTreeFile(validTreeFile)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(serializeTree(parsed.tree)).toBe(validTreeFile)
  })

  it('preserves unknown fields at every supported level', () => {
    const parsed = parseTreeFile(unknownFieldsFile)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(JSON.parse(serializeTree(parsed.tree))).toEqual(
      JSON.parse(unknownFieldsFile),
    )
    expect(parsed.tree.nodes[0]!.metaData.futurePosition).toBe('preserved')
  })

  it('imports files with save history metadata and preserves it on re-export', () => {
    const file = `${JSON.stringify(
      {
        version: 1,
        metaData: {
          saveHistory: [
            {
              savedAt: '2026-11-12T20:00:00.000Z',
              target: 'googleDrive',
              unknown: 'kept',
            },
          ],
          futureMeta: 1,
        },
        nodes: [
          {
            id: 'anna',
            data: { firstName: 'Anna' },
            metaData: { layer: 0, order: 0 },
          },
        ],
        edges: [],
      },
      null,
      2,
    )}\n`
    const parsed = parseTreeFile(file)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(JSON.parse(serializeTree(parsed.tree))).toEqual(JSON.parse(file))
  })

  it('round-trips optional wedding dates and rejects them on other edge types', () => {
    const weddingDateFile = `${JSON.stringify(
      {
        version: 1,
        nodes: [
          {
            id: 'anna',
            data: { firstName: 'Anna' },
            metaData: { layer: 0, order: 0 },
          },
          {
            id: 'jan',
            data: { firstName: 'Jan' },
            metaData: { layer: 0, order: 1 },
          },
        ],
        edges: [
          {
            from: 'anna',
            to: 'jan',
            type: 'marriage',
            dateOfMarriage: '2001-06-23',
            futureEdgeField: 'preserved',
          },
        ],
      },
      null,
      2,
    )}\n`
    const parsed = parseTreeFile(weddingDateFile)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(serializeTree(parsed.tree)).toBe(weddingDateFile)
    const legacyTree = JSON.parse(weddingDateFile) as {
      edges: Array<Record<string, unknown>>
    }
    delete legacyTree.edges[0]!.dateOfMarriage
    const legacyMarriageFile = `${JSON.stringify(legacyTree, null, 2)}\n`
    const parsedLegacyMarriage = parseTreeFile(legacyMarriageFile)
    expect(parsedLegacyMarriage.ok).toBe(true)
    if (parsedLegacyMarriage.ok) {
      expect(serializeTree(parsedLegacyMarriage.tree)).toBe(legacyMarriageFile)
    }
    expect(
      parseTreeFile(weddingDateFile.replace('2001-06-23', '2001-02-30')).ok,
    ).toBe(false)
    expect(
      parseTreeFile(weddingDateFile.replace('"marriage"', '"sibling"')).ok,
    ).toBe(false)
  })

  it('repairs gaps and duplicate positions per part while preserving metadata', () => {
    const parsed = parseTreeFile(
      JSON.stringify({
        version: 1,
        nodes: [
          {
            id: 'first',
            data: { firstName: 'Anna' },
            metaData: { layer: 4, order: 8, note: 'preserved' },
          },
          {
            id: 'second',
            data: { firstName: 'Jan' },
            metaData: { layer: 4, order: 8 },
          },
          {
            id: 'child',
            data: { firstName: 'Mia' },
            metaData: { layer: 9, order: 5 },
          },
        ],
        edges: [
          { from: 'first', to: 'child', type: 'child' },
          { from: 'first', to: 'second', type: 'sibling' },
        ],
      }),
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(
      parsed.tree.nodes.map(({ id, metaData }) => [
        id,
        metaData.layer,
        metaData.order,
      ]),
    ).toEqual([
      ['first', 0, 0],
      ['second', 0, 1],
      ['child', 1, 0],
    ])
    expect(parsed.tree.nodes[0]!.metaData.note).toBe('preserved')
  })

  it('does not reject or repair child level relationships on import', () => {
    const parsed = parseTreeFile(
      JSON.stringify({
        version: 1,
        nodes: [
          {
            id: 'parent',
            data: { firstName: 'Anna' },
            metaData: { layer: 1, order: 0 },
          },
          {
            id: 'child',
            data: { firstName: 'Mia' },
            metaData: { layer: 0, order: 0 },
          },
        ],
        edges: [{ from: 'parent', to: 'child', type: 'child' }],
      }),
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.tree.nodes.map(({ metaData }) => metaData.layer)).toEqual([
      1, 0,
    ])
  })

  it.each([
    emptyFile,
    nonJsonFile,
    wrongShapeFile,
    wrongVersionFile,
    '{"version":1,"nodes":[{"id":"person","data":{"firstName":""}}],"edges":[]}',
  ])('returns the same failure for invalid input %j', (text) => {
    expect(parseTreeFile(text)).toEqual({ ok: false })
  })

  it('accepts a tree with no people', () => {
    expect(parseTreeFile(emptyNodesFile)).toEqual({
      ok: true,
      tree: { version: 1, nodes: [], edges: [] },
    })
  })
})
