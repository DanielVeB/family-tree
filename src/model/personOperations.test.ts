import { describe, expect, it } from 'vitest'
import {
  countConnectedParts,
  deletePerson,
  getConnectedParts,
  getDeletePreview,
  TreeSchema,
  TreeOperationError,
  updatePerson,
  type FamilyTree,
} from './tree'
import editUnknownFields from './fixtures/edit-unknown-fields.json'
import deleteParentFixture from './fixtures/delete-parent.json'
import deleteSplitFixture from './fixtures/delete-split-tree.json'
import { parseTreeFile } from '../io/importTree'
import { serializeTree } from '../io/exportTree'

function makeTree(
  people: string[],
  edges: FamilyTree['edges'] = [],
): FamilyTree {
  return {
    version: 1,
    title: 'preserved',
    nodes: people.map((id) => ({
      id,
      data: { firstName: id, note: `note-${id}` },
      extra: `extra-${id}`,
    })),
    edges,
  }
}

describe('person editing', () => {
  it('trims names, preserves unknown fields, people, and all edges', () => {
    const tree = makeTree(
      ['anna', 'piotr', 'mia'],
      [
        { from: 'anna', to: 'mia', type: 'child' },
        { from: 'piotr', to: 'mia', type: 'sibling' },
      ],
    )
    const updated = updatePerson(tree, 'anna', {
      firstName: '  Łucja ',
      lastName: ' Żółć ',
    })
    expect(updated.nodes[0]).toEqual({
      id: 'anna',
      data: { firstName: 'Łucja', lastName: 'Żółć', note: 'note-anna' },
      extra: 'extra-anna',
    })
    expect(updated.nodes.slice(1)).toEqual(tree.nodes.slice(1))
    expect(updated.edges).toBe(tree.edges)
    expect(updated.title).toBe('preserved')
    expect(tree.nodes[0]!.data.firstName).toBe('anna')
  })

  it('returns the original tree when trimmed names are unchanged', () => {
    const tree = makeTree(['anna'])
    expect(
      updatePerson(tree, 'anna', { firstName: ' anna ', lastName: ' ' }),
    ).toBe(tree)
  })

  it('rejects invalid names and unknown people without mutation', () => {
    const tree = makeTree(['anna'])
    expect(() => updatePerson(tree, 'anna', { firstName: '  ' })).toThrowError(
      new TreeOperationError('emptyFirstName'),
    )
    expect(() =>
      updatePerson(tree, 'anna', { firstName: 'a'.repeat(101) }),
    ).toThrowError(new TreeOperationError('nameTooLong'))
    expect(() =>
      updatePerson(tree, 'anna', {
        firstName: 'Anna',
        lastName: 'a'.repeat(101),
      }),
    ).toThrowError(new TreeOperationError('nameTooLong'))
    expect(() =>
      updatePerson(tree, 'missing', { firstName: 'Valid' }),
    ).toThrowError(new TreeOperationError('unknownPerson'))
    expect(tree.nodes[0]!.data.firstName).toBe('anna')
  })

  it('preserves unknown person data through edit and export/import', () => {
    const tree = TreeSchema.parse(editUnknownFields)
    const updated = updatePerson(tree, 'person-anna', {
      firstName: 'Anna',
      lastName: 'Nowak',
    })
    const result = parseTreeFile(serializeTree(updated))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tree.nodes[0]!.data.customNote).toBe(
      'Fictional field to verify forward compatibility',
    )
    expect(result.tree.nodes[0]!.customNodeField).toBe('preserved')
  })
})

describe('person deletion and connected parts', () => {
  it('removes all incident edge kinds while preserving other edge and item order', () => {
    const tree = makeTree(
      ['parent', 'child-a', 'child-b', 'other-parent', 'partner', 'alone'],
      [
        { from: 'parent', to: 'child-a', type: 'child' },
        { from: 'parent', to: 'child-b', type: 'child' },
        { from: 'child-a', to: 'child-b', type: 'sibling' },
        { from: 'other-parent', to: 'child-a', type: 'child' },
        { from: 'parent', to: 'partner', type: 'marriage' },
      ],
    )
    const deleted = deletePerson(tree, 'parent')
    expect(deleted.nodes.map(({ id }) => id)).toEqual([
      'child-a',
      'child-b',
      'other-parent',
      'partner',
      'alone',
    ])
    expect(deleted.edges).toEqual([
      { from: 'child-a', to: 'child-b', type: 'sibling' },
      { from: 'other-parent', to: 'child-a', type: 'child' },
    ])
    expect(TreeSchema.safeParse(deleted).success).toBe(true)
    expect(tree.nodes).toHaveLength(6)
    expect(() => deletePerson(tree, 'missing')).toThrowError(
      new TreeOperationError('unknownPerson'),
    )
  })

  it('previews relationship and part counts, including isolated and empty trees', () => {
    const tree = makeTree(
      ['bridge', 'left', 'right', 'alone'],
      [
        { from: 'bridge', to: 'left', type: 'child' },
        { from: 'bridge', to: 'right', type: 'marriage' },
      ],
    )
    expect(getConnectedParts(tree)).toEqual([
      ['bridge', 'left', 'right'],
      ['alone'],
    ])
    expect(countConnectedParts(tree)).toBe(2)
    expect(getDeletePreview(tree, 'bridge')).toEqual({
      relationshipCount: 2,
      partCount: 3,
    })
    expect(getDeletePreview(makeTree(['only']), 'only')).toEqual({
      relationshipCount: 0,
      partCount: 0,
    })
    expect(countConnectedParts(makeTree([]))).toBe(0)
    expect(countConnectedParts(makeTree(['one']))).toBe(1)
  })

  it('keeps children connected after deleting their shared parent', () => {
    const tree = TreeSchema.parse(deleteParentFixture)
    const deleted = deletePerson(tree, 'person-anna')
    expect(deleted.edges).toEqual([
      {
        from: 'person-mia',
        to: 'person-olek',
        type: 'sibling',
      },
    ])
    expect(getConnectedParts(deleted)).toEqual([['person-mia', 'person-olek']])
  })

  it('previews the disconnected parts in the split-tree fixture', () => {
    const tree = TreeSchema.parse(deleteSplitFixture)
    expect(getDeletePreview(tree, 'person-mia')).toEqual({
      relationshipCount: 2,
      partCount: 2,
    })
  })
})
