import { describe, expect, it } from 'vitest'
import { getTimelineEvents } from './timeline'
import type { FamilyTree } from '../model/tree'

const tree: FamilyTree = {
  version: 1,
  nodes: [
    {
      id: 'a',
      data: {
        firstName: 'Anna',
        lastName: 'Testowa',
        dateOfBirth: '1987-01-01',
        dateOfDeath: '2020',
      },
      metaData: { layer: 0, order: 0 },
    },
    {
      id: 'b',
      data: { firstName: 'Jan', dateOfBirth: '1987' },
      metaData: { layer: 0, order: 1 },
    },
    {
      id: 'c',
      data: { firstName: 'Ola', dateOfBirth: '1987-01' },
      metaData: { layer: 0, order: 2 },
    },
    {
      id: 'd',
      data: { firstName: 'Piotr', dateOfBirth: '1986-12-31' },
      metaData: { layer: 0, order: 3 },
    },
    {
      id: 'e',
      data: { firstName: 'Zofia', dateOfBirth: '2021-05' },
      metaData: { layer: 0, order: 0 },
    },
  ],
  edges: [
    { from: 'a', to: 'b', type: 'marriage', dateOfMarriage: '1987' },
    { from: 'c', to: 'd', type: 'marriage', dateOfMarriage: '1987-01-01' },
    { from: 'a', to: 'd', type: 'child' },
  ],
}

describe('getTimelineEvents', () => {
  it('orders all dated events by partial date and keeps source order for ties', () => {
    expect(getTimelineEvents(tree)).toEqual([
      {
        type: 'birth',
        date: '1986-12-31',
        people: ['Piotr'],
      },
      {
        type: 'birth',
        date: '1987',
        people: ['Jan'],
      },
      {
        type: 'marriage',
        date: '1987',
        people: ['Anna Testowa', 'Jan'],
      },
      {
        type: 'birth',
        date: '1987-01',
        people: ['Ola'],
      },
      {
        type: 'birth',
        date: '1987-01-01',
        people: ['Anna Testowa'],
      },
      {
        type: 'marriage',
        date: '1987-01-01',
        people: ['Ola', 'Piotr'],
      },
      {
        type: 'death',
        date: '2020',
        people: ['Anna Testowa'],
      },
      {
        type: 'birth',
        date: '2021-05',
        people: ['Zofia'],
      },
    ])
  })

  it('collects person events before marriage events and keeps equal dates separate', () => {
    const events = getTimelineEvents(tree)
    const sameDateEvents = events.filter(({ date }) => date === '1987-01-01')

    expect(sameDateEvents).toEqual([
      {
        type: 'birth',
        date: '1987-01-01',
        people: ['Anna Testowa'],
      },
      {
        type: 'marriage',
        date: '1987-01-01',
        people: ['Ola', 'Piotr'],
      },
    ])
  })

  it('omits undated people and non-marriage relationships', () => {
    expect(
      getTimelineEvents({
        ...tree,
        nodes: tree.nodes.map((person) => ({
          ...person,
          data: { firstName: person.data.firstName },
        })),
        edges: [{ from: 'a', to: 'b', type: 'child' }],
      }),
    ).toEqual([])
  })

  it('returns an empty list for a tree without recorded dates', () => {
    expect(getTimelineEvents({ version: 1, nodes: [], edges: [] })).toEqual([])
  })
})
