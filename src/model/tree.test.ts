import { describe, expect, it } from 'vitest'
import {
  addFirstPerson,
  addRelative,
  createEmptyTree,
  getDisplayName,
  TreeOperationError,
  TreeSchema,
} from './tree'

describe('family tree operations', () => {
  it('creates a first person without mutating the empty tree and trims names', () => {
    const empty = createEmptyTree()
    const tree = addFirstPerson(empty, {
      firstName: '  Anna ',
      lastName: ' Testowa  ',
    })
    expect(empty.nodes).toEqual([])
    expect(tree).toMatchObject({
      version: 1,
      nodes: [
        {
          id: expect.any(String),
          data: { firstName: 'Anna', lastName: 'Testowa' },
        },
      ],
      edges: [],
    })
    expect(tree.nodes[0]!.id).not.toBe('')
    expect(getDisplayName(tree.nodes[0]!)).toBe('Anna Testowa')
  })

  it('keeps Polish names and omits an empty surname from the display name', () => {
    const tree = addFirstPerson(createEmptyTree(), {
      firstName: 'Łucja',
      lastName: 'Żółć',
    })
    expect(tree.nodes[0]!.data).toEqual({
      firstName: 'Łucja',
      lastName: 'Żółć',
    })
    expect(
      getDisplayName({
        id: 'unknown-surname',
        data: { firstName: 'Jan', lastName: '' },
      }),
    ).toBe('Jan')
  })

  it.each([
    ['parent', 'child'],
    ['child', 'child'],
    ['sibling', 'sibling'],
    ['partner', 'marriage'],
  ] as const)(
    'adds a %s relative as the correct %s edge',
    (relation, edgeType) => {
      const initial = addFirstPerson(createEmptyTree(), {
        firstName: 'First',
      })
      const result = addRelative(initial, initial.nodes[0]!.id, relation, {
        firstName: 'Second',
      })
      const firstId = initial.nodes[0]!.id
      const secondId = result.nodes[1]!.id
      const from = relation === 'parent' ? secondId : firstId
      const to = relation === 'parent' ? firstId : secondId
      expect(initial.nodes).toHaveLength(1)
      expect(result.edges).toEqual([{ from, to, type: edgeType }])
    },
  )

  it('rejects empty or too-long names with typed errors', () => {
    expect(() =>
      addFirstPerson(createEmptyTree(), { firstName: '  ' }),
    ).toThrowError(new TreeOperationError('emptyFirstName'))
    expect(() =>
      addFirstPerson(createEmptyTree(), { firstName: 'a'.repeat(101) }),
    ).toThrowError(new TreeOperationError('nameTooLong'))
    expect(() =>
      addFirstPerson(createEmptyTree(), {
        firstName: 'Valid',
        lastName: 'a'.repeat(101),
      }),
    ).toThrowError(new TreeOperationError('nameTooLong'))
  })

  it('rejects relatives of unknown people', () => {
    const tree = addFirstPerson(createEmptyTree(), { firstName: 'Anna' })
    expect(() =>
      addRelative(tree, 'missing', 'child', { firstName: 'Child' }),
    ).toThrowError(new TreeOperationError('unknownPerson'))
  })
})

describe('tree schema', () => {
  const validTree = {
    version: 1,
    title: 'preserved',
    nodes: [
      { id: 'a', data: { firstName: 'Anna', extra: 'preserved' } },
      { id: 'b', data: { firstName: 'Jan' } },
    ],
    edges: [],
  }

  it('preserves unknown top-level and person data fields', () => {
    const parsed = TreeSchema.parse(validTree)
    expect(parsed.title).toBe('preserved')
    expect(parsed.nodes[0]!.data.extra).toBe('preserved')
  })

  it.each([
    {
      ...validTree,
      nodes: [...validTree.nodes, validTree.nodes[0]],
    },
    {
      ...validTree,
      edges: [{ from: 'a', to: 'a', type: 'sibling' }],
    },
    {
      ...validTree,
      edges: [{ from: 'a', to: 'missing', type: 'child' }],
    },
    {
      ...validTree,
      edges: [
        { from: 'a', to: 'b', type: 'sibling' },
        { from: 'b', to: 'a', type: 'sibling' },
      ],
    },
    {
      ...validTree,
      edges: [
        { from: 'a', to: 'b', type: 'child' },
        { from: 'b', to: 'a', type: 'child' },
      ],
    },
    {
      ...validTree,
      edges: [{ from: 'a', to: 'b', type: 'unknown' }],
    },
    {
      ...validTree,
      nodes: [{ id: 'a', data: { firstName: '  ' } }],
    },
    {
      ...validTree,
      version: 2,
    },
    {
      ...validTree,
      nodes: [{ id: 'a', data: { firstName: 42 } }],
    },
  ])('rejects invalid graph data', (invalidTree) => {
    expect(TreeSchema.safeParse(invalidTree).success).toBe(false)
  })
})
