import { describe, expect, it } from 'vitest'
import { computeLayout } from './computeLayout'
import type { FamilyTree } from '../model/tree'

const person = (id: string) => ({
  id,
  data: { firstName: id, lastName: '' },
})
const tree = (ids: string[], edges: FamilyTree['edges'] = []): FamilyTree => ({
  version: 1,
  nodes: ids.map(person),
  edges,
})

describe('computeLayout', () => {
  it('places a single person and has no edge paths', () => {
    const layout = computeLayout(tree(['a']))
    expect(layout.positions.a).toEqual({ x: 40, y: 40 })
    expect(layout.edgePaths).toEqual([])
  })

  it('places parents above children with a parent-to-child path', () => {
    const layout = computeLayout(
      tree(
        ['parent', 'child'],
        [{ from: 'parent', to: 'child', type: 'child' }],
      ),
    )
    expect(layout.positions.parent!.y).toBeLessThan(layout.positions.child!.y)
    expect(layout.edgePaths[0]!.path).toContain('V')
    expect(layout.edgePaths[0]!.path).toContain('H')
  })

  it('keeps siblings on one row and draws one bracket connector', () => {
    const layout = computeLayout(
      tree(['one', 'two'], [{ from: 'one', to: 'two', type: 'sibling' }]),
    )
    expect(layout.positions.one!.y).toBe(layout.positions.two!.y)
    expect(layout.positions.two!.x - layout.positions.one!.x).toBe(240)
    expect(layout.edgePaths[0]!.path).toContain('V')
  })

  it('keeps married partners adjacent and groups their children below', () => {
    const layout = computeLayout(
      tree(
        ['parent-a', 'parent-b', 'child-a', 'child-b'],
        [
          { from: 'parent-a', to: 'parent-b', type: 'marriage' },
          { from: 'parent-a', to: 'child-a', type: 'child' },
          { from: 'parent-b', to: 'child-a', type: 'child' },
          { from: 'parent-a', to: 'child-b', type: 'child' },
          { from: 'parent-b', to: 'child-b', type: 'child' },
        ],
      ),
    )
    expect(layout.positions['parent-a']!.y).toBe(
      layout.positions['parent-b']!.y,
    )
    expect(
      layout.positions['parent-b']!.x - layout.positions['parent-a']!.x,
    ).toBe(240)
    expect(layout.positions['child-a']!.x + 100).toBe(
      (layout.positions['parent-a']!.x +
        layout.positions['parent-b']!.x +
        200) /
        2,
    )
    expect(layout.positions['child-a']!.y).toBeGreaterThan(
      layout.positions['parent-a']!.y,
    )
    expect(layout.positions['child-b']!.y).toBe(layout.positions['child-a']!.y)
    expect(layout.edgePaths).toHaveLength(1)
  })

  it('places three generations on successive rows', () => {
    const layout = computeLayout(
      tree(
        ['a', 'b', 'c'],
        [
          { from: 'a', to: 'b', type: 'child' },
          { from: 'b', to: 'c', type: 'child' },
        ],
      ),
    )
    expect(layout.positions.c!.y - layout.positions.b!.y).toBe(
      layout.positions.b!.y - layout.positions.a!.y,
    )
  })

  it('supports a child with two parents', () => {
    const layout = computeLayout(
      tree(
        ['a', 'b', 'child'],
        [
          { from: 'a', to: 'child', type: 'child' },
          { from: 'b', to: 'child', type: 'child' },
        ],
      ),
    )
    expect(layout.positions.child!.y).toBeGreaterThan(layout.positions.a!.y)
    expect(layout.edgePaths).toHaveLength(1)
  })

  it('lays out a couple and three shared children without overlap', () => {
    const ids = ['anna', 'piotr', 'mia', 'olek', 'zosia']
    const edges = [
      { from: 'anna', to: 'piotr', type: 'marriage' as const },
      ...['mia', 'olek', 'zosia'].flatMap((childId) => [
        { from: 'anna', to: childId, type: 'child' as const },
        { from: 'piotr', to: childId, type: 'child' as const },
      ]),
    ]
    const layout = computeLayout(tree(ids, edges))

    expect(layout.positions.anna!.y).toBe(layout.positions.piotr!.y)
    for (const childId of ids.slice(2)) {
      expect(layout.positions[childId]!.y).toBeGreaterThan(
        layout.positions.anna!.y,
      )
    }
    expectNoOverlaps(layout, ids)
    expect(layout.edgePaths.every(({ path }) => path.length > 0)).toBe(true)
  })

  it('draws one shared connector from two parents to all of their children', () => {
    const ids = ['parent-a', 'parent-b', 'child-a', 'child-b', 'child-c']
    const layout = computeLayout(
      tree(ids, [
        { from: 'parent-a', to: 'parent-b', type: 'marriage' },
        ...ids.slice(2).flatMap((childId) => [
          { from: 'parent-a', to: childId, type: 'child' as const },
          { from: 'parent-b', to: childId, type: 'child' as const },
        ]),
      ]),
    )
    expect(layout.edgePaths).toHaveLength(1)
    expect(layout.edgePaths[0]!.path.match(/M /g)).toHaveLength(6)
    expectNoOverlaps(layout, ids)
  })

  it('keeps a newly added partner beside the person in a sibling group', () => {
    const ids = ['parent-a', 'parent-b', 'child-a', 'child-b', 'child-c', 'partner']
    const layout = computeLayout(
      tree(ids, [
        { from: 'parent-a', to: 'parent-b', type: 'marriage' },
        ...ids.slice(2, 5).flatMap((childId) => [
          { from: 'parent-a', to: childId, type: 'child' as const },
          { from: 'parent-b', to: childId, type: 'child' as const },
        ]),
        { from: 'child-a', to: 'child-b', type: 'sibling' },
        { from: 'child-b', to: 'child-c', type: 'sibling' },
        { from: 'child-a', to: 'partner', type: 'marriage' },
      ]),
    )

    expect(layout.positions.partner!.x - layout.positions['child-a']!.x).toBe(
      240,
    )
  })

  it('keeps half-siblings attached below their respective parents', () => {
    const ids = ['anna', 'piotr', 'marek', 'mia', 'olek']
    const layout = computeLayout(
      tree(ids, [
        { from: 'anna', to: 'piotr', type: 'marriage' },
        { from: 'anna', to: 'marek', type: 'marriage' },
        { from: 'anna', to: 'mia', type: 'child' },
        { from: 'piotr', to: 'mia', type: 'child' },
        { from: 'anna', to: 'olek', type: 'child' },
        { from: 'marek', to: 'olek', type: 'child' },
      ]),
    )
    expect(layout.positions.anna!.y).toBe(layout.positions.piotr!.y)
    expect(layout.positions.piotr!.y).toBe(layout.positions.marek!.y)
    expect(layout.positions.mia!.y).toBe(layout.positions.olek!.y)
    expect(layout.positions.mia!.x).not.toBe(layout.positions.olek!.x)
    expectNoOverlaps(layout, ids)
    expect(layout.edgePaths.every(({ path }) => path.length > 0)).toBe(true)
  })

  it('places children below two parents even when the parents are not partners', () => {
    const layout = computeLayout(
      tree(
        ['anna', 'tomek', 'mia'],
        [
          { from: 'anna', to: 'mia', type: 'child' },
          { from: 'tomek', to: 'mia', type: 'child' },
        ],
      ),
    )
    expect(layout.positions.mia!.y).toBeGreaterThan(layout.positions.anna!.y)
    expect(layout.positions.mia!.y).toBeGreaterThan(layout.positions.tomek!.y)
    expectNoOverlaps(layout, ['anna', 'tomek', 'mia'])
  })

  it('handles a tree of 30 people without card overlap', () => {
    const ids = Array.from({ length: 30 }, (_, index) => `person-${index}`)
    const edges = ids.slice(1).map((id, index) => ({
      from: ids[index]!,
      to: id,
      type: 'child' as const,
    }))
    const layout = computeLayout(tree(ids, edges))
    expect(Object.keys(layout.positions)).toHaveLength(30)
    expectNoOverlaps(layout, ids)
  })

  it('does not overlap cards and leaves node order stable when a person is added', () => {
    const initial = computeLayout(tree(['a', 'b', 'c']))
    const extended = computeLayout(tree(['a', 'b', 'c', 'd']))
    expect(extended.positions.a).toEqual(initial.positions.a)
    expect(extended.positions.b).toEqual(initial.positions.b)
    expect(extended.positions.c).toEqual(initial.positions.c)
    const xPositions = Object.values(extended.positions).map(({ x }) => x)
    expect(new Set(xPositions).size).toBe(xPositions.length)
  })
})

function expectNoOverlaps(
  layout: ReturnType<typeof computeLayout>,
  ids: string[],
  width = 200,
  height = 88,
) {
  for (let first = 0; first < ids.length; first += 1) {
    for (let second = first + 1; second < ids.length; second += 1) {
      const a = layout.positions[ids[first]!]!
      const b = layout.positions[ids[second]!]!
      const overlaps =
        a.x < b.x + width &&
        a.x + width > b.x &&
        a.y < b.y + height &&
        a.y + height > b.y
      expect(overlaps, `${ids[first]} overlaps ${ids[second]}`).toBe(false)
    }
  }
}
