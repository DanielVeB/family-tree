import type { FamilyTree, TreeEdge } from '../model/tree'

export interface Point {
  x: number
  y: number
}

export interface LayoutResult {
  positions: Record<string, Point>
  edgePaths: Array<{ edge: TreeEdge; path: string }>
  width: number
  height: number
}

const CARD_HEIGHT = 88
const HORIZONTAL_GAP = 40
const VERTICAL_GAP = 64

export function computeLayout(tree: FamilyTree, cardWidth = 200): LayoutResult {
  const indexById = new Map(tree.nodes.map((node, index) => [node.id, index]))
  const parent = new Map(tree.nodes.map((node) => [node.id, node.id]))
  const find = (id: string): string => {
    const root = parent.get(id)!
    if (root === id) return id
    const result = find(root)
    parent.set(id, result)
    return result
  }
  const unite = (a: string, b: string) => {
    const first = find(a)
    const second = find(b)
    if (first !== second) {
      const firstIndex = indexById.get(first) ?? 0
      const secondIndex = indexById.get(second) ?? 0
      parent.set(
        firstIndex <= secondIndex ? second : first,
        firstIndex <= secondIndex ? first : second,
      )
    }
  }

  for (const edge of tree.edges) {
    if (edge.type !== 'child') unite(edge.from, edge.to)
  }

  const membersByGroup = new Map<string, string[]>()
  for (const node of tree.nodes) {
    const group = find(node.id)
    membersByGroup.set(group, [...(membersByGroup.get(group) ?? []), node.id])
  }
  const groups = [...membersByGroup.entries()]
    .map(([id, members]) => ({
      id,
      members: members.sort((a, b) => indexById.get(a)! - indexById.get(b)!),
      order: Math.min(...members.map((member) => indexById.get(member)!)),
      generation: 0,
    }))
    .sort((a, b) => a.order - b.order)
  const groupByNode = new Map<string, (typeof groups)[number]>()
  groups.forEach((group) =>
    group.members.forEach((member) => groupByNode.set(member, group)),
  )

  const constraints = tree.edges
    .filter((edge) => edge.type === 'child')
    .map((edge) => ({
      parent: groupByNode.get(edge.from)!,
      child: groupByNode.get(edge.to)!,
    }))
    .filter(({ parent: parentGroup, child }) => parentGroup !== child)

  for (let pass = 0; pass < groups.length; pass += 1) {
    let updated = false
    for (const { parent: parentGroup, child } of constraints) {
      if (child.generation <= parentGroup.generation) {
        child.generation = parentGroup.generation + 1
        updated = true
      }
    }
    if (!updated) break
  }

  const rows = new Map<number, (typeof groups)[number][]>()
  groups.forEach((group) =>
    rows.set(group.generation, [...(rows.get(group.generation) ?? []), group]),
  )
  const positions: Record<string, Point> = {}
  let maxWidth = 0
  for (const [generation, row] of [...rows].sort(([a], [b]) => a - b)) {
    let nextX = 40
    for (const group of row) {
      const groupWidth =
        group.members.length * cardWidth +
        Math.max(0, group.members.length - 1) * HORIZONTAL_GAP
      const parentGroups = [
        ...new Set(
          constraints
            .filter(({ child }) => child === group)
            .map(({ parent: parentGroup }) => parentGroup),
        ),
      ]
      const parentCenters = parentGroups
        .map((parentGroup) => {
          const parentPositions = parentGroup.members
            .map((id) => positions[id])
            .filter((point): point is Point => Boolean(point))
          if (!parentPositions.length) return undefined
          const left = Math.min(...parentPositions.map((point) => point.x))
          const right =
            Math.max(...parentPositions.map((point) => point.x)) + cardWidth
          return (left + right) / 2
        })
        .filter((center): center is number => center !== undefined)
      const desiredX = parentCenters.length
        ? parentCenters.reduce((sum, center) => sum + center, 0) /
            parentCenters.length -
          groupWidth / 2
        : nextX
      const x = Math.max(nextX, desiredX)
      let memberX = x
      for (const id of group.members) {
        positions[id] = {
          x: memberX,
          y: 40 + generation * (CARD_HEIGHT + VERTICAL_GAP),
        }
        memberX += cardWidth + HORIZONTAL_GAP
      }
      nextX = x + groupWidth + HORIZONTAL_GAP
    }
    maxWidth = Math.max(maxWidth, nextX)
  }

  const edgePaths = tree.edges.map((edge) => ({
    edge,
    path: getEdgePath(edge, positions, cardWidth),
  }))
  const maxGeneration = Math.max(0, ...groups.map((group) => group.generation))
  return {
    positions,
    edgePaths,
    width: Math.max(maxWidth, cardWidth + 80),
    height: 80 + (maxGeneration + 1) * (CARD_HEIGHT + VERTICAL_GAP),
  }
}

function getEdgePath(
  edge: TreeEdge,
  positions: Record<string, Point>,
  cardWidth: number,
): string {
  const from = positions[edge.from]
  const to = positions[edge.to]
  if (!from || !to) return ''

  if (edge.type === 'marriage') {
    const left = from.x < to.x ? from : to
    const right = from.x < to.x ? to : from
    if (right.x - left.x > cardWidth + HORIZONTAL_GAP) {
      const y = Math.min(left.y, right.y) - 16
      return `M ${left.x + cardWidth / 2} ${left.y} V ${y} H ${right.x + cardWidth / 2} V ${right.y}`
    }
    return `M ${left.x + cardWidth} ${left.y + CARD_HEIGHT / 2} H ${right.x}`
  }
  if (edge.type === 'sibling') {
    const left = from.x < to.x ? from : to
    const right = from.x < to.x ? to : from
    const y = Math.min(left.y, right.y) - 16
    return `M ${left.x + cardWidth / 2} ${left.y} V ${y} H ${right.x + cardWidth / 2} V ${right.y}`
  }

  const fromX = from.x + cardWidth / 2
  const toX = to.x + cardWidth / 2
  if (to.y - from.y > CARD_HEIGHT + VERTICAL_GAP) {
    const rightEdge = Math.max(
      ...Object.values(positions).map((point) => point.x + cardWidth),
    )
    return `M ${fromX} ${from.y + CARD_HEIGHT} V ${from.y + CARD_HEIGHT + 16} H ${rightEdge + 16} V ${to.y - 16} H ${toX} V ${to.y}`
  }
  const middleY = from.y + CARD_HEIGHT + VERTICAL_GAP / 2
  return `M ${fromX} ${from.y + CARD_HEIGHT} V ${middleY} H ${toX} V ${to.y}`
}
