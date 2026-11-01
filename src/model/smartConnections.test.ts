import { describe, expect, it } from 'vitest'
import {
  addRelative,
  getChildrenOf,
  getCoParentsOf,
  getConnectionQuestions,
  getDefaultConnectionAnswers,
  getParentCount,
  getParentsOf,
  getPartnersOf,
  getSiblingsOf,
  TreeOperationError,
  type FamilyTree,
} from './tree'
import { serializeTree } from '../io/exportTree'
import { parseTreeFile } from '../io/importTree'

function makeTree(
  people: string[],
  edges: FamilyTree['edges'] = [],
): FamilyTree {
  return {
    version: 1,
    nodes: people.map((id) => ({ id, data: { firstName: id } })),
    edges,
  }
}

const child = (from: string, to: string) => ({
  from,
  to,
  type: 'child' as const,
})
const sibling = (from: string, to: string) => ({
  from,
  to,
  type: 'sibling' as const,
})
const marriage = (from: string, to: string) => ({
  from,
  to,
  type: 'marriage' as const,
})
const answersFor = (
  questions: ReturnType<typeof getConnectionQuestions>,
  selected: Record<string, boolean> = {},
  choice: string | null = null,
) => ({
  ...getDefaultConnectionAnswers(questions),
  checked: { ...getDefaultConnectionAnswers(questions).checked, ...selected },
  choice,
})

describe('relationship helpers', () => {
  const tree = makeTree(
    ['anna', 'piotr', 'marek', 'mia', 'olek', 'zosia'],
    [
      child('anna', 'mia'),
      child('piotr', 'mia'),
      child('anna', 'olek'),
      marriage('anna', 'marek'),
      sibling('olek', 'zosia'),
    ],
  )

  it('returns parents, children, partners, co-parents, and deduplicated siblings', () => {
    expect(getParentsOf(tree, 'mia')).toEqual(['anna', 'piotr'])
    expect(getChildrenOf(tree, 'anna')).toEqual(['mia', 'olek'])
    expect(getPartnersOf(tree, 'anna')).toEqual(['marek'])
    expect(getCoParentsOf(tree, 'anna')).toEqual(['piotr'])
    expect(getSiblingsOf(tree, 'mia')).toEqual(['olek'])
    expect(getSiblingsOf(tree, 'olek')).toEqual(['mia', 'zosia'])
  })
})

describe('smart connection questions and operations', () => {
  it('P1-P5 offers each child as a checked partner connection, disables children with two parents', () => {
    const tree = makeTree(
      ['anna', 'mia', 'olek', 'zosia', 'piotr'],
      [
        child('anna', 'mia'),
        child('anna', 'olek'),
        child('anna', 'zosia'),
        child('piotr', 'olek'),
      ],
    )
    const [group] = getConnectionQuestions(tree, 'anna', 'partner')
    expect(group).toMatchObject({
      id: 'partnerChildren',
      kind: 'checkboxes',
      items: [
        { personId: 'mia', defaultChecked: true },
        {
          personId: 'olek',
          defaultChecked: false,
          disabledReason: 'twoParents',
        },
        { personId: 'zosia', defaultChecked: true },
      ],
    })
    expect(getConnectionQuestions(tree, 'piotr', 'partner')[0]).toMatchObject({
      id: 'partnerChildren',
      items: [
        {
          personId: 'olek',
          defaultChecked: false,
          disabledReason: 'twoParents',
        },
      ],
    })

    const many = makeTree(
      ['anna', 'c1', 'c2', 'c3', 'c4'],
      ['c1', 'c2', 'c3', 'c4'].map((id) => child('anna', id)),
    )
    expect(
      getConnectionQuestions(many, 'anna', 'partner')[0]?.items,
    ).toHaveLength(4)
  })

  it('adds a partner and checked child edges in stable primary-first order', () => {
    const tree = makeTree(
      ['anna', 'mia', 'olek'],
      [child('anna', 'mia'), child('anna', 'olek')],
    )
    const questions = getConnectionQuestions(tree, 'anna', 'partner')
    const answers = answersFor(questions, {
      'partnerChildren:mia': true,
      'partnerChildren:olek': false,
    })
    const updated = addRelative(
      tree,
      'anna',
      'partner',
      { firstName: 'Piotr' },
      answers,
    )
    const partner = updated.nodes[3]!.id
    expect(updated.edges.slice(2)).toEqual([
      marriage('anna', partner),
      child(partner, 'mia'),
    ])
  })

  it('C1-C6 chooses other-parent and sibling connections in deterministic edge order', () => {
    const noCandidates = makeTree(['anna'])
    expect(getConnectionQuestions(noCandidates, 'anna', 'child')).toEqual([])

    const one = makeTree(['anna', 'piotr'], [marriage('anna', 'piotr')])
    expect(getConnectionQuestions(one, 'anna', 'child')).toMatchObject([
      {
        id: 'childOtherParent',
        kind: 'single-checkbox',
        items: [{ personId: 'piotr', defaultChecked: true }],
      },
    ])

    const multiple = makeTree(
      ['anna', 'mia', 'tomek', 'piotr', 'marek'],
      [
        child('anna', 'mia'),
        child('tomek', 'mia'),
        marriage('anna', 'piotr'),
        marriage('anna', 'marek'),
      ],
    )
    expect(getConnectionQuestions(multiple, 'anna', 'child')[0]).toMatchObject({
      kind: 'choice',
      items: [
        { personId: 'tomek' },
        { personId: 'piotr' },
        { personId: 'marek' },
      ],
    })
    expect(getConnectionQuestions(multiple, 'anna', 'child')[1]).toMatchObject({
      id: 'childSiblings',
      kind: 'checkboxes',
      items: [{ personId: 'mia', defaultChecked: true }],
    })
  })

  it('adds only selected explicit sibling links after other-parent edges when adding a child', () => {
    const tree = makeTree(
      ['anna', 'piotr', 'mia', 'olek'],
      [
        marriage('anna', 'piotr'),
        child('anna', 'mia'),
        child('anna', 'olek'),
      ],
    )
    const questions = getConnectionQuestions(tree, 'anna', 'child')
    expect(questions).toMatchObject([
      {
        id: 'childOtherParent',
        kind: 'single-checkbox',
        items: [{ personId: 'piotr', defaultChecked: true }],
      },
      {
        id: 'childSiblings',
        kind: 'checkboxes',
        items: [
          { personId: 'mia', defaultChecked: true },
          { personId: 'olek', defaultChecked: true },
        ],
      },
    ])
    const updated = addRelative(
      tree,
      'anna',
      'child',
      { firstName: 'Zosia' },
      answersFor(questions, { 'childSiblings:olek': false }),
    )
    const newId = updated.nodes[4]!.id
    expect(updated.edges.slice(tree.edges.length)).toEqual([
      child('anna', newId),
      child('piotr', newId),
      sibling(newId, 'mia'),
    ])
  })

  it('requires an explicit other-parent choice and accepts the no-parent answer', () => {
    const tree = makeTree(
      ['anna', 'piotr', 'marek'],
      [marriage('anna', 'piotr'), marriage('anna', 'marek')],
    )
    const questions = getConnectionQuestions(tree, 'anna', 'child')
    const original = JSON.stringify(tree)
    expect(() =>
      addRelative(tree, 'anna', 'child', { firstName: 'Olek' }),
    ).toThrowError(new TreeOperationError('missingConnectionChoice'))
    expect(JSON.stringify(tree)).toBe(original)
    const updated = addRelative(
      tree,
      'anna',
      'child',
      { firstName: 'Olek' },
      answersFor(questions, {}, '__none__'),
    )
    expect(getParentCount(updated, updated.nodes[3]!.id)).toBe(1)
  })

  it('B1-B5 adds selected parents and sibling links with fresh checked defaults', () => {
    expect(getConnectionQuestions(makeTree(['mia']), 'mia', 'sibling')).toEqual(
      [],
    )
    const tree = makeTree(
      ['anna', 'piotr', 'mia', 'olek'],
      [child('anna', 'mia'), child('piotr', 'mia'), sibling('mia', 'olek')],
    )
    expect(getConnectionQuestions(tree, 'mia', 'sibling')).toMatchObject([
      {
        id: 'siblingParents',
        items: [
          { personId: 'anna', defaultChecked: true },
          { personId: 'piotr', defaultChecked: true },
        ],
      },
      {
        id: 'siblingSiblings',
        items: [{ personId: 'olek', defaultChecked: true }],
      },
    ])
    const questions = getConnectionQuestions(tree, 'mia', 'sibling')
    const updated = addRelative(
      tree,
      'mia',
      'sibling',
      { firstName: 'Zosia' },
      answersFor(questions, { 'siblingParents:piotr': false }),
    )
    const newId = updated.nodes[4]!.id
    expect(updated.edges.slice(3)).toEqual([
      sibling('mia', newId),
      child('anna', newId),
      sibling(newId, 'olek'),
    ])
  })

  it('R1-R7 enforces the parent limit and offers siblings and couple connection', () => {
    const twoParents = makeTree(
      ['anna', 'piotr', 'mia'],
      [child('anna', 'mia'), child('piotr', 'mia')],
    )
    expect(() =>
      getConnectionQuestions(twoParents, 'mia', 'parent'),
    ).toThrowError(new TreeOperationError('tooManyParents'))
    expect(() =>
      addRelative(twoParents, 'mia', 'parent', { firstName: 'Marek' }),
    ).toThrowError(new TreeOperationError('tooManyParents'))

    const withSiblingAndSingleParent = makeTree(
      ['anna', 'mia', 'olek', 'zosia', 'marek', 'piotr', 'tomek'],
      [
        child('anna', 'mia'),
        child('anna', 'olek'),
        child('piotr', 'zosia'),
        child('tomek', 'zosia'),
        sibling('mia', 'zosia'),
        marriage('anna', 'marek'),
      ],
    )
    const questions = getConnectionQuestions(
      withSiblingAndSingleParent,
      'mia',
      'parent',
    )
    expect(questions).toMatchObject([
      {
        id: 'parentSiblings',
        items: [
          { personId: 'olek', defaultChecked: true },
          {
            personId: 'zosia',
            defaultChecked: false,
            disabledReason: 'twoParents',
          },
        ],
      },
      {
        id: 'parentCouple',
        items: [{ personId: 'anna', defaultChecked: false }],
      },
    ])
    const answer = answersFor(questions, {
      'parentSiblings:olek': true,
      'parentCouple:anna': true,
    })
    const updated = addRelative(
      withSiblingAndSingleParent,
      'mia',
      'parent',
      { firstName: 'Tomek' },
      answer,
    )
    const newId = updated.nodes[7]!.id
    expect(updated.edges.slice(6)).toEqual([
      child(newId, 'mia'),
      child(newId, 'olek'),
      marriage(newId, 'anna'),
    ])

    const noPartner = makeTree(['anna', 'mia'], [child('anna', 'mia')])
    expect(getConnectionQuestions(noPartner, 'mia', 'parent')).toMatchObject([
      {
        id: 'parentCouple',
        items: [{ personId: 'anna', defaultChecked: true }],
      },
    ])
    expect(
      getConnectionQuestions(
        makeTree(['mia', 'olek'], [sibling('mia', 'olek')]),
        'mia',
        'parent',
      ),
    ).toMatchObject([
      {
        id: 'parentSiblings',
        items: [{ personId: 'olek', defaultChecked: true }],
      },
    ])
  })

  it('rejects attempts to override disabled connections without mutating the input', () => {
    const tree = makeTree(
      ['anna', 'piotr', 'mia', 'olek'],
      [child('anna', 'mia'), child('anna', 'olek'), child('piotr', 'olek')],
    )
    const questions = getConnectionQuestions(tree, 'anna', 'partner')
    const original = JSON.stringify(tree)
    expect(() =>
      addRelative(
        tree,
        'anna',
        'partner',
        { firstName: 'Marek' },
        answersFor(questions, { 'partnerChildren:olek': true }),
      ),
    ).toThrowError(new TreeOperationError('invalidConnectionAnswer'))
    expect(JSON.stringify(tree)).toBe(original)
  })

  it('limits sibling connection defaults to two parents in older imported trees', () => {
    const tree = makeTree(
      ['parent-a', 'parent-b', 'parent-c', 'target'],
      [
        child('parent-a', 'target'),
        child('parent-b', 'target'),
        child('parent-c', 'target'),
      ],
    )
    expect(getConnectionQuestions(tree, 'target', 'sibling')[0]?.items).toEqual([
      { personId: 'parent-a', defaultChecked: true },
      { personId: 'parent-b', defaultChecked: true },
      {
        personId: 'parent-c',
        defaultChecked: false,
        disabledReason: 'twoParents',
      },
    ])
  })

  it('rejects connections for unknown targets and does not mutate trees on failure', () => {
    const tree = makeTree(
      ['anna', 'piotr', 'marek'],
      [marriage('anna', 'piotr'), marriage('anna', 'marek')],
    )
    expect(() => getConnectionQuestions(tree, 'missing', 'child')).toThrowError(
      new TreeOperationError('unknownPerson'),
    )
    expect(() =>
      addRelative(
        tree,
        'anna',
        'child',
        { firstName: 'Mia' },
        { checked: {}, choice: 'unknown-person' },
      ),
    ).toThrowError(new TreeOperationError('invalidConnectionAnswer'))
    expect(tree.nodes).toHaveLength(3)
  })

  it('round-trips a tree built with smart connections byte-for-byte', () => {
    let tree = makeTree(['anna'])
    tree = addRelative(tree, 'anna', 'partner', { firstName: 'Piotr' })
    const anna = tree.nodes[0]!.id
    const piotr = tree.nodes[1]!.id
    tree = addRelative(tree, anna, 'child', { firstName: 'Mia' })
    const mia = tree.nodes[2]!.id
    tree = addRelative(tree, mia, 'sibling', { firstName: 'Olek' })

    const exported = serializeTree(tree)
    const parsed = parseTreeFile(exported)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(serializeTree(parsed.tree)).toBe(exported)
    expect(getParentsOf(parsed.tree, mia)).toEqual([anna, piotr])
  })
})
