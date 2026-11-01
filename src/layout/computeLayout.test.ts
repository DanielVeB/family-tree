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
    expect(layout.edgePaths).toHaveLength(5)
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
    expect(layout.edgePaths).toHaveLength(2)
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
