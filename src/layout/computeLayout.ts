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
  const partnersByPerson = new Map<string, string[]>()
  for (const edge of tree.edges) {
    if (edge.type !== 'marriage') continue
    partnersByPerson.set(edge.from, [
      ...(partnersByPerson.get(edge.from) ?? []),
      edge.to,
    ])
    partnersByPerson.set(edge.to, [
      ...(partnersByPerson.get(edge.to) ?? []),
      edge.from,
    ])
  }
  const groups = [...membersByGroup.entries()]
    .map(([id, members]) => ({
      id,
      members: orderGroupMembers(
        members,
        partnersByPerson,
        indexById,
      ),
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

  const familyGroups = getTwoParentFamilies(tree)
  const consumedEdges = new Set<TreeEdge>()
  const familyPathByEdge = new Map<TreeEdge, string>()
  for (const family of familyGroups) {
    family.childEdges.forEach((edge) => consumedEdges.add(edge))
    const marriage = tree.edges.find(
      (edge) =>
        edge.type === 'marriage' &&
        samePair(edge.from, edge.to, family.parents[0], family.parents[1]),
    )
    const representative = marriage ?? family.childEdges[0]!
    if (marriage) consumedEdges.add(marriage)
    familyPathByEdge.set(
      representative,
      getFamilyPath(family, positions, cardWidth),
    )
  }
  const edgePaths: LayoutResult['edgePaths'] = []
  for (const edge of tree.edges) {
    const familyPath = familyPathByEdge.get(edge)
    if (familyPath !== undefined) {
      edgePaths.push({ edge, path: familyPath })
    } else if (!consumedEdges.has(edge)) {
      edgePaths.push({ edge, path: getEdgePath(edge, positions, cardWidth) })
    }
  }
  const maxGeneration = Math.max(0, ...groups.map((group) => group.generation))
  return {
    positions,
    edgePaths,
    width: Math.max(maxWidth, cardWidth + 80),
    height: 80 + (maxGeneration + 1) * (CARD_HEIGHT + VERTICAL_GAP),
  }
}

function orderGroupMembers(
  members: string[],
  partnersByPerson: Map<string, string[]>,
  indexById: Map<string, number>,
): string[] {
  const ordered: string[] = []
  const included = new Set<string>()
  const byIndex = [...members].sort(
    (a, b) => indexById.get(a)! - indexById.get(b)!,
  )

  for (const id of byIndex) {
    if (included.has(id)) continue
    ordered.push(id)
    included.add(id)
    const partners = (partnersByPerson.get(id) ?? [])
      .filter((partner) => members.includes(partner) && !included.has(partner))
      .sort((a, b) => indexById.get(a)! - indexById.get(b)!)
    for (const partner of partners) {
      ordered.push(partner)
      included.add(partner)
    }
  }
  return ordered
}

interface TwoParentFamily {
  parents: [string, string]
  children: string[]
  childEdges: TreeEdge[]
}

function getTwoParentFamilies(tree: FamilyTree): TwoParentFamily[] {
  const families = new Map<string, TwoParentFamily>()
  for (const child of tree.nodes) {
    const childEdges = tree.edges.filter(
      (edge) => edge.type === 'child' && edge.to === child.id,
    )
    if (childEdges.length !== 2) continue
    const parents = childEdges
      .map((edge) => edge.from)
      .sort(
        (a, b) =>
          tree.nodes.findIndex((node) => node.id === a) -
          tree.nodes.findIndex((node) => node.id === b),
      ) as [string, string]
    const key = JSON.stringify(parents)
    const family = families.get(key) ?? {
      parents,
      children: [],
      childEdges: [],
    }
    family.children.push(child.id)
    family.childEdges.push(...childEdges)
    families.set(key, family)
  }
  return [...families.values()]
}

function samePair(
  firstA: string,
  firstB: string,
  secondA: string,
  secondB: string,
): boolean {
  return (
    (firstA === secondA && firstB === secondB) ||
    (firstA === secondB && firstB === secondA)
  )
}

function getFamilyPath(
  family: TwoParentFamily,
  positions: Record<string, Point>,
  cardWidth: number,
): string {
  const parents = family.parents
    .map((id) => positions[id])
    .filter((point): point is Point => Boolean(point))
    .sort((a, b) => a.x - b.x)
  const children = family.children
    .map((id) => positions[id])
    .filter((point): point is Point => Boolean(point))
    .sort((a, b) => a.x - b.x)
  if (parents.length !== 2 || children.length === 0) return ''

  const parentCenters = parents.map((point) => point.x + cardWidth / 2)
  const parentJoinY = Math.max(
    ...parents.map((point) => point.y + CARD_HEIGHT),
  ) + 16
  const familyCenterX = (parentCenters[0]! + parentCenters[1]!) / 2
  const childJoinY = Math.min(...children.map((point) => point.y)) - 16
  const childCenters = children.map((point) => point.x + cardWidth / 2)
  const commands = [
    `M ${parentCenters[0]} ${parents[0]!.y + CARD_HEIGHT} V ${parentJoinY} H ${parentCenters[1]}`,
    `M ${parentCenters[1]} ${parents[1]!.y + CARD_HEIGHT} V ${parentJoinY}`,
    `M ${familyCenterX} ${parentJoinY} V ${childJoinY} H ${childCenters[0]}`,
  ]
  for (const child of children) {
    const center = child.x + cardWidth / 2
    commands.push(`M ${center} ${childJoinY} V ${child.y}`)
  }
  if (childCenters.length > 1) {
    commands.push(
      `M ${childCenters[0]} ${childJoinY} H ${childCenters[childCenters.length - 1]}`,
    )
  }
  return commands.join(' ')
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
