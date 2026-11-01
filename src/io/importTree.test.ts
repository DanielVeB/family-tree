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
