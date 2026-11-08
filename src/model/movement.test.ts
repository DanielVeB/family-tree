import { describe, expect, it } from 'vitest'
import {
  assignLayers,
  addRelativeWithResult,
  getConnectedPeople,
  getMoveLevelAvailability,
  moveSelection,
  type FamilyTree,
} from './tree'

const makeTree = (
  people: Array<[string, number, number]>,
  edges: FamilyTree['edges'],
): FamilyTree => ({
  version: 1,
  nodes: people.map(([id, layer, order]) => ({
    id,
    data: { firstName: id },
    metaData: { layer, order },
  })),
  edges,
})

describe('person movement', () => {
  it('collects ancestors, descendants, and partner chains without in-laws', () => {
    const tree = makeTree(
      [
        ['grandparent', 0, 0],
        ['parent', 1, 0],
        ['person', 2, 0],
        ['partner', 2, 1],
        ['partner-chain', 2, 2],
        ['child', 3, 0],
        ['sibling', 2, 3],
        ['in-law', 1, 1],
        ['partner-child', 3, 1],
      ],
      [
        { from: 'grandparent', to: 'parent', type: 'child' },
        { from: 'parent', to: 'person', type: 'child' },
        { from: 'person', to: 'child', type: 'child' },
        { from: 'person', to: 'sibling', type: 'sibling' },
        { from: 'person', to: 'partner', type: 'marriage' },
        { from: 'partner', to: 'partner-chain', type: 'marriage' },
        { from: 'in-law', to: 'partner', type: 'child' },
        { from: 'partner', to: 'partner-child', type: 'child' },
      ],
    )
    expect(getConnectedPeople(tree, 'person')).toEqual([
      'grandparent',
      'parent',
      'person',
      'partner',
      'partner-chain',
      'child',
    ])
  })

  it('moves levels and row order atomically without changing person data or edges', () => {
    const tree = makeTree(
      [
        ['parent', 0, 0],
        ['person', 1, 0],
        ['other', 1, 1],
        ['child', 2, 0],
      ],
      [
        { from: 'parent', to: 'person', type: 'child' },
        { from: 'person', to: 'child', type: 'child' },
        { from: 'person', to: 'other', type: 'sibling' },
      ],
    )
    const moved = moveSelection(tree, {
      personId: 'other',
      targetLayer: 1,
      dx: -300,
      moveConnected: false,
      centers: { parent: 100, person: 300, other: 500, child: 100 },
    })
    expect(moved.nodes.find(({ id }) => id === 'other')?.metaData.order).toBe(0)
    expect(moved.nodes.find(({ id }) => id === 'person')?.metaData.order).toBe(
      1,
    )
    expect(moved.edges).toBe(tree.edges)
    expect(moved.nodes.find(({ id }) => id === 'other')?.data).toEqual(
      tree.nodes.find(({ id }) => id === 'other')?.data,
    )
    expect(tree.nodes.find(({ id }) => id === 'other')?.metaData.order).toBe(1)
  })

  it('reports valid levels and rejects a move that puts a child level with its parent', () => {
    const tree = makeTree(
      [
        ['parent', 0, 0],
        ['person', 1, 0],
        ['child', 2, 0],
      ],
      [
        { from: 'parent', to: 'person', type: 'child' },
        { from: 'person', to: 'child', type: 'child' },
      ],
    )
    expect(getMoveLevelAvailability(tree, 'person')).toEqual([
      {
        layer: 0,
        onlyThisPersonValid: false,
        withConnectedPeopleValid: false,
      },
      {
        layer: 1,
        onlyThisPersonValid: true,
        withConnectedPeopleValid: true,
      },
      {
        layer: 2,
        onlyThisPersonValid: false,
        withConnectedPeopleValid: true,
      },
    ])
    expect(() =>
      moveSelection(tree, {
        personId: 'person',
        targetLayer: 2,
        dx: 0,
        moveConnected: false,
      }),
    ).toThrow()
    const moved = moveSelection(tree, {
      personId: 'person',
      targetLayer: 2,
      dx: 0,
      moveConnected: true,
    })
    expect(moved.nodes.map(({ metaData }) => metaData.layer)).toEqual([0, 1, 2])
  })

  it('assigns levels to married and sibling groups while preserving parent order', () => {
    const tree = makeTree(
      [
        ['jan', 0, 0],
        ['maria', 0, 1],
        ['celina', 0, 2],
        ['dariusz', 0, 3],
        ['marek', 0, 4],
        ['ewa', 0, 5],
        ['stefan', 0, 6],
        ['helena', 0, 7],
      ],
      [
        { from: 'jan', to: 'celina', type: 'child' },
        { from: 'maria', to: 'celina', type: 'child' },
        { from: 'celina', to: 'dariusz', type: 'marriage' },
        { from: 'marek', to: 'dariusz', type: 'child' },
        { from: 'ewa', to: 'dariusz', type: 'child' },
        { from: 'stefan', to: 'marek', type: 'child' },
        { from: 'helena', to: 'marek', type: 'child' },
        { from: 'jan', to: 'maria', type: 'marriage' },
        { from: 'marek', to: 'ewa', type: 'marriage' },
        { from: 'stefan', to: 'helena', type: 'marriage' },
      ],
    )
    const assigned = assignLayers(tree)
    const layers = Object.fromEntries(
      assigned.nodes.map(({ id, metaData }) => [id, metaData.layer]),
    )
    expect(layers).toMatchObject({
      stefan: 0,
      helena: 0,
      marek: 1,
      ewa: 1,
      jan: 1,
      maria: 1,
      celina: 2,
      dariusz: 2,
    })
  })

  it('reports when adding a relative recalculates invalid layer relationships', () => {
    const tree = makeTree(
      [
        ['parent', 2, 0],
        ['child', 1, 0],
      ],
      [{ from: 'parent', to: 'child', type: 'child' }],
    )
    const result = addRelativeWithResult(tree, 'parent', 'sibling', {
      firstName: 'Sibling',
    })
    expect(result.levelsRecalculated).toBe(true)
    const layers = new Map(
      result.tree.nodes.map(({ id, metaData }) => [id, metaData.layer]),
    )
    expect(layers.get('parent')).toBeLessThan(layers.get('child')!)
  })
})
