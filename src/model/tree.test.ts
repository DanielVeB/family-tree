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
          metaData: { layer: 0, order: 0 },
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
        metaData: { layer: 0, order: 0 },
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

  it('keeps new relatives at stored levels and shifts the part when adding a top parent', () => {
    let tree = addFirstPerson(createEmptyTree(), { firstName: 'Jan' })
    const janId = tree.nodes[0]!.id
    tree = addRelative(tree, janId, 'child', { firstName: 'Celina' })
    const celinaId = tree.nodes[tree.nodes.length - 1]!.id
    tree = addRelative(tree, celinaId, 'partner', { firstName: 'Dariusz' })
    const dariuszId = tree.nodes[tree.nodes.length - 1]!.id
    tree = addRelative(tree, dariuszId, 'parent', { firstName: 'Marek' })
    const marekId = tree.nodes[tree.nodes.length - 1]!.id
    tree = addRelative(tree, dariuszId, 'parent', { firstName: 'Ewa' })
    tree = addRelative(tree, marekId, 'parent', { firstName: 'Stefan' })

    const layerByName = Object.fromEntries(
      tree.nodes.map((person) => [
        person.data.firstName,
        person.metaData.layer,
      ]),
    )
    expect(layerByName).toEqual({
      Jan: 1,
      Celina: 2,
      Dariusz: 2,
      Marek: 1,
      Ewa: 1,
      Stefan: 0,
    })
    expect(
      tree.nodes
        .filter((person) => person.metaData.layer === 1)
        .map((person) => person.metaData.order)
        .sort((a, b) => a - b),
    ).toEqual([0, 1, 2])
  })
})

describe('tree schema', () => {
  const validTree = {
    version: 1,
    title: 'preserved',
    nodes: [
      {
        id: 'a',
        data: { firstName: 'Anna', extra: 'preserved' },
        metaData: { layer: 0, order: 0 },
      },
      {
        id: 'b',
        data: { firstName: 'Jan' },
        metaData: { layer: 0, order: 1 },
      },
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
      nodes: [
        {
          id: 'a',
          data: { firstName: '  ' },
          metaData: { layer: 0, order: 0 },
        },
      ],
    },
    {
      ...validTree,
      nodes: [
        {
          id: 'a',
          data: { firstName: 'Anna' },
          metaData: { order: 0 },
        },
      ],
    },
    {
      ...validTree,
      nodes: [
        {
          id: 'a',
          data: { firstName: 'Anna' },
          metaData: { layer: -1, order: 0 },
        },
      ],
    },
    {
      ...validTree,
      nodes: [
        {
          id: 'a',
          data: { firstName: 'Anna' },
          metaData: { layer: 0, order: 0.5 },
        },
      ],
    },
    {
      ...validTree,
      version: 2,
    },
    {
      ...validTree,
      nodes: [
        {
          id: 'a',
          data: { firstName: 42 },
          metaData: { layer: 0, order: 0 },
        },
      ],
    },
  ])('rejects invalid graph data', (invalidTree) => {
    expect(TreeSchema.safeParse(invalidTree).success).toBe(false)
  })
})
