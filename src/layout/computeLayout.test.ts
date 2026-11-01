import { describe, expect, it } from 'vitest'
import { computeLayout, LAYOUT_SPACING } from './computeLayout'
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
    expect(layout.positions.two!.x - layout.positions.one!.x).toBe(
      200 + LAYOUT_SPACING.siblingGap,
    )
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
    ).toBe(200 + LAYOUT_SPACING.partnerGap)
    expect(
      (layout.positions['child-a']!.x + layout.positions['child-b']!.x + 200) /
        2,
    ).toBe(
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
    const secondParent = layout.positions['parent-b']!
    expect(layout.edgePaths[0]!.path).toContain(
      `M ${(layout.positions['parent-a']!.x + 200 + secondParent.x) / 2} ${secondParent.y + 44} V`,
    )
    expectNoOverlaps(layout, ids)
  })

  it('centers a wide child group below its parents instead of pinning it to the row edge', () => {
    const children = ['child-a', 'child-b', 'child-c', 'child-d', 'child-e']
    const layout = computeLayout(
      tree(
        ['parent-a', 'parent-b', ...children],
        [
          { from: 'parent-a', to: 'parent-b', type: 'marriage' },
          ...children.flatMap((childId) => [
            { from: 'parent-a', to: childId, type: 'child' as const },
            { from: 'parent-b', to: childId, type: 'child' as const },
          ]),
        ],
      ),
    )
    const parentCenter =
      (layout.positions['parent-a']!.x +
        layout.positions['parent-b']!.x +
        200) /
      2
    const childCenter =
      (layout.positions['child-a']!.x + layout.positions['child-e']!.x + 200) /
      2
    expect(childCenter).toBe(parentCenter)
    expectNoOverlaps(layout, ['parent-a', 'parent-b', ...children])
  })

  it('extends the children bus to the couple point when children are offset to the right', () => {
    const layout = computeLayout(
      tree(
        ['parent-a', 'parent-b', 'child-a', 'child-b', 'child-partner'],
        [
          { from: 'parent-a', to: 'parent-b', type: 'marriage' },
          { from: 'parent-a', to: 'child-a', type: 'child' },
          { from: 'parent-b', to: 'child-a', type: 'child' },
          { from: 'parent-a', to: 'child-b', type: 'child' },
          { from: 'parent-b', to: 'child-b', type: 'child' },
          { from: 'child-a', to: 'child-partner', type: 'marriage' },
        ],
      ),
    )
    const familyPath = layout.edgePaths.find(
      ({ people }) => people.includes('parent-a') && people.includes('child-a'),
    )
    expect(familyPath).toBeDefined()
    const couplePointX =
      (layout.positions['parent-a']!.x +
        200 +
        layout.positions['parent-b']!.x) /
      2
    const busY = layout.positions['parent-a']!.y + 88 + LAYOUT_SPACING.lineInset
    const childCenters = [
      layout.positions['child-a']!.x + 100,
      layout.positions['child-b']!.x + 100,
    ]
    expect(familyPath!.path).toContain(
      `M ${Math.min(couplePointX, ...childCenters)} ${busY} H ${Math.max(couplePointX, ...childCenters)}`,
    )
    expect(layout.positions['child-a']!.x + 100).toBeGreaterThan(couplePointX)
  })

  it('keeps a newly added partner beside the person in a sibling group', () => {
    const ids = [
      'parent-a',
      'parent-b',
      'child-a',
      'child-b',
      'child-c',
      'partner',
    ]
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

    expect(
      layout.positions.partner!.x - (layout.positions['child-a']!.x + 200),
    ).toBe(LAYOUT_SPACING.partnerGap)
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
    expect(layout.positions.anna!.x - (layout.positions.piotr!.x + 200)).toBe(
      LAYOUT_SPACING.partnerGap,
    )
    expect(layout.positions.marek!.x - (layout.positions.anna!.x + 200)).toBe(
      LAYOUT_SPACING.partnerGap,
    )
    expect(layout.positions.mia!.y).toBe(layout.positions.olek!.y)
    expect(
      layout.positions.olek!.x - (layout.positions.mia!.x + 200),
    ).toBeGreaterThanOrEqual(LAYOUT_SPACING.blockGap)
    expect(
      layout.edgePaths.filter(
        ({ people }) => people.includes('mia') || people.includes('olek'),
      ),
    ).toHaveLength(2)
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

  it('keeps two sibling groups visibly separate while joining their families at the couple', () => {
    const ids = [
      'jan',
      'maria',
      'adam',
      'beata',
      'celina',
      'dariusz',
      'edward',
      'francis',
      'halina',
      'ireneusz',
    ]
    const childEdges = ['adam', 'beata', 'celina'].flatMap((childId) => [
      { from: 'jan', to: childId, type: 'child' as const },
      { from: 'maria', to: childId, type: 'child' as const },
    ])
    const layout = computeLayout(
      tree(ids, [
        { from: 'jan', to: 'maria', type: 'marriage' },
        ...childEdges,
        { from: 'adam', to: 'beata', type: 'sibling' },
        { from: 'beata', to: 'celina', type: 'sibling' },
        { from: 'celina', to: 'dariusz', type: 'marriage' },
        { from: 'dariusz', to: 'edward', type: 'sibling' },
        { from: 'edward', to: 'francis', type: 'marriage' },
        { from: 'celina', to: 'halina', type: 'child' },
        { from: 'dariusz', to: 'halina', type: 'child' },
        { from: 'celina', to: 'ireneusz', type: 'child' },
        { from: 'dariusz', to: 'ireneusz', type: 'child' },
      ]),
    )
    const rowOne = ['adam', 'beata', 'celina', 'dariusz', 'edward', 'francis']
    expect(rowOne.map((id) => layout.positions[id]!.x)).toEqual(
      [...rowOne.map((id) => layout.positions[id]!.x)].sort((a, b) => a - b),
    )
    expect(
      layout.positions.dariusz!.x - (layout.positions.celina!.x + 200),
    ).toBe(LAYOUT_SPACING.partnerGap)
    expect(
      layout.positions.edward!.x - (layout.positions.dariusz!.x + 200),
    ).toBe(LAYOUT_SPACING.siblingGap)
    expect(
      layout.positions.francis!.x - (layout.positions.edward!.x + 200),
    ).toBe(LAYOUT_SPACING.partnerGap)
    expect(layout.positions.halina!.y).toBeGreaterThan(
      layout.positions.celina!.y,
    )
    expect(
      (layout.positions.halina!.x + layout.positions.ireneusz!.x + 200) / 2,
    ).toBe((layout.positions.celina!.x + 200 + layout.positions.dariusz!.x) / 2)
    const familyPath = layout.edgePaths.find(
      ({ people }) => people.includes('celina') && people.includes('dariusz'),
    )
    expect(familyPath?.dots).toHaveLength(1)
  })

  it('keeps the family geometry when input nodes and edges are reversed', () => {
    const ids = ['parent-a', 'parent-b', 'child-a', 'child-b', 'partner']
    const edges: FamilyTree['edges'] = [
      { from: 'parent-a', to: 'parent-b', type: 'marriage' },
      { from: 'parent-a', to: 'child-a', type: 'child' },
      { from: 'parent-b', to: 'child-a', type: 'child' },
      { from: 'parent-a', to: 'child-b', type: 'child' },
      { from: 'parent-b', to: 'child-b', type: 'child' },
      { from: 'child-b', to: 'partner', type: 'marriage' },
    ]
    const forward = computeLayout(tree(ids, edges))
    const reversed = computeLayout(
      tree([...ids].reverse(), [...edges].reverse()),
    )
    for (const layout of [forward, reversed]) {
      expect(
        layout.positions['parent-a']!.x + layout.positions['parent-b']!.x + 200,
      ).toBe(
        layout.positions['child-a']!.x + layout.positions['child-b']!.x + 200,
      )
      const partnerGap = Math.min(
        Math.abs(
          layout.positions['child-b']!.x - (layout.positions.partner!.x + 200),
        ),
        Math.abs(
          layout.positions.partner!.x - (layout.positions['child-b']!.x + 200),
        ),
      )
      expect(partnerGap).toBe(LAYOUT_SPACING.partnerGap)
    }
  })

  it('leaves a block gap between unrelated sibling groups', () => {
    const layout = computeLayout(
      tree(
        ['a', 'b', 'c', 'd'],
        [
          { from: 'a', to: 'b', type: 'sibling' },
          { from: 'c', to: 'd', type: 'sibling' },
        ],
      ),
    )
    expect(
      layout.positions.c!.x - (layout.positions.b!.x + 200),
    ).toBeGreaterThanOrEqual(LAYOUT_SPACING.blockGap)
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
