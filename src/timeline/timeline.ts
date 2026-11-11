import { getDisplayName, type FamilyTree } from '../model/tree'

export type TimelineEventType = 'birth' | 'death' | 'marriage'

export interface TimelineEvent {
  type: TimelineEventType
  date: string
  people: string[]
}

function comparePartialDates(left: string, right: string): number {
  const leftParts = left.split('-').map(Number)
  const rightParts = right.split('-').map(Number)

  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? -1) - (rightParts[index] ?? -1)
    if (difference !== 0) return difference
  }
  return 0
}

export function getTimelineEvents(tree: FamilyTree): TimelineEvent[] {
  const orderedEvents: Array<{ event: TimelineEvent; order: number }> = []
  const personNames = new Map(
    tree.nodes.map((person) => [person.id, getDisplayName(person)]),
  )

  tree.nodes.forEach((person) => {
    if (person.data.dateOfBirth) {
      orderedEvents.push({
        event: {
          type: 'birth',
          date: person.data.dateOfBirth,
          people: [getDisplayName(person)],
        },
        order: orderedEvents.length,
      })
    }
    if (person.data.dateOfDeath) {
      orderedEvents.push({
        event: {
          type: 'death',
          date: person.data.dateOfDeath,
          people: [getDisplayName(person)],
        },
        order: orderedEvents.length,
      })
    }
  })

  tree.edges.forEach((edge) => {
    if (edge.type !== 'marriage' || !edge.dateOfMarriage) return
    const firstPartner = personNames.get(edge.from)
    const secondPartner = personNames.get(edge.to)
    if (!firstPartner || !secondPartner) return

    orderedEvents.push({
      event: {
        type: 'marriage',
        date: edge.dateOfMarriage,
        people: [firstPartner, secondPartner],
      },
      order: orderedEvents.length,
    })
  })

  return orderedEvents
    .sort(
      (left, right) =>
        comparePartialDates(left.event.date, right.event.date) ||
        left.order - right.order,
    )
    .map(({ event }) => event)
}
