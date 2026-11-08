import {
  getConnectedParts,
  type FamilyTree,
  type TreeEdge,
} from '../model/tree'
import { LAYOUT_SPACING } from './config'

export { LAYOUT_SPACING } from './config'

export interface Point {
  x: number
  y: number
}

export interface LayoutLine {
  edge: TreeEdge
  path: string
  people: string[]
  dots: Point[]
}

export interface LayoutResult {
  positions: Record<string, Point>
  cardCenters: Record<string, Point>
  rowBands: Array<{
    layer: number
    left: number
    top: number
    width: number
    height: number
    personIds: string[]
  }>
  edgePaths: LayoutLine[]
  width: number
  height: number
}

const { cardHeight: CARD_HEIGHT } = LAYOUT_SPACING

interface SiblingGroup {
  id: string
  members: string[]
  order: number
  generation: number
}

interface Family {
  parents: string[]
  children: string[]
  edges: TreeEdge[]
  generation: number
  lane: number
}

export function computeLayout(tree: FamilyTree, cardWidth = 200): LayoutResult {
  const parts = getConnectedParts(tree)
  if (parts.length === 0) {
    return {
      positions: {},
      cardCenters: {},
      rowBands: [],
      edgePaths: [],
      width: LAYOUT_SPACING.margin * 2,
      height: LAYOUT_SPACING.margin * 2,
    }
  }
  if (parts.length > 1) {
    let offset = 0
    let height = 0
    const positions: Record<string, Point> = {}
    const cardCenters: Record<string, Point> = {}
    const rowBands: LayoutResult['rowBands'] = []
    const edgePaths: LayoutLine[] = []
    for (const ids of parts) {
      const members = new Set(ids)
      const partTree: FamilyTree = {
        ...tree,
        nodes: tree.nodes.filter(({ id }) => members.has(id)),
        edges: tree.edges.filter(
          (edge) => members.has(edge.from) && members.has(edge.to),
        ),
      }
      const partLayout = computeLayout(partTree, cardWidth)
      for (const [id, point] of Object.entries(partLayout.positions)) {
        positions[id] = { ...point, x: point.x + offset }
        cardCenters[id] = {
          x: point.x + offset + cardWidth / 2,
          y: point.y + CARD_HEIGHT / 2,
        }
      }
      rowBands.push(
        ...partLayout.rowBands.map((band) => ({
          ...band,
          left: band.left + offset,
        })),
      )
      edgePaths.push(
        ...partLayout.edgePaths.map((line) => ({
          ...line,
          path: shiftPathHorizontally(line.path, offset),
          dots: line.dots.map((dot) => ({ ...dot, x: dot.x + offset })),
        })),
      )
      offset += partLayout.width + LAYOUT_SPACING.partGap
      height = Math.max(height, partLayout.height)
    }
    return {
      positions,
      cardCenters,
      rowBands,
      edgePaths,
      width: offset - LAYOUT_SPACING.partGap,
      height,
    }
  }

  const creationIndex = new Map(
    tree.nodes.map((node, index) => [node.id, index]),
  )
  const layoutOrder = [...tree.nodes].sort(
    (a, b) =>
      a.metaData.layer - b.metaData.layer ||
      a.metaData.order - b.metaData.order ||
      creationIndex.get(a.id)! - creationIndex.get(b.id)!,
  )
  const indexById = new Map(layoutOrder.map((node, index) => [node.id, index]))
  const nodeIds = new Set(indexById.keys())
  const parentByPerson = new Map(
    tree.nodes.map((node) => [node.id, [] as string[]]),
  )
  const childrenByPerson = new Map(
    tree.nodes.map((node) => [node.id, [] as string[]]),
  )
  const partnersByPerson = new Map(
    tree.nodes.map((node) => [node.id, [] as string[]]),
  )
  const explicitSiblingEdges: TreeEdge[] = []
  for (const edge of tree.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue
    if (edge.type === 'child') {
      parentByPerson.get(edge.to)!.push(edge.from)
      childrenByPerson.get(edge.from)!.push(edge.to)
    } else if (edge.type === 'marriage') {
      partnersByPerson.get(edge.from)!.push(edge.to)
      partnersByPerson.get(edge.to)!.push(edge.from)
    } else if (edge.type === 'sibling') {
      explicitSiblingEdges.push(edge)
    }
  }

  const rootById = new Map(tree.nodes.map((node) => [node.id, node.id]))
  const find = (id: string): string => {
    const root = rootById.get(id)
    if (!root || root === id) return id
    const resolved = find(root)
    rootById.set(id, resolved)
    return resolved
  }
  const unite = (first: string, second: string) => {
    if (!nodeIds.has(first) || !nodeIds.has(second)) return
    if (
      tree.nodes.find(({ id }) => id === first)!.metaData.layer !==
      tree.nodes.find(({ id }) => id === second)!.metaData.layer
    ) {
      return
    }
    const left = find(first)
    const right = find(second)
    if (left === right) return
    const leftOrder = indexById.get(left) ?? 0
    const rightOrder = indexById.get(right) ?? 0
    rootById.set(
      leftOrder <= rightOrder ? right : left,
      leftOrder <= rightOrder ? left : right,
    )
  }

  for (const edge of explicitSiblingEdges) {
    unite(edge.from, edge.to)
  }
  for (const children of childrenByPerson.values()) {
    for (let index = 1; index < children.length; index += 1) {
      unite(children[0]!, children[index]!)
    }
  }

  const membersByRoot = new Map<string, string[]>()
  for (const person of tree.nodes) {
    const root = find(person.id)
    const members = membersByRoot.get(root) ?? []
    members.push(person.id)
    membersByRoot.set(root, members)
  }

  const groups: SiblingGroup[] = [...membersByRoot.entries()]
    .map(([id, members]) => ({
      id,
      members: members.sort((a, b) => indexById.get(a)! - indexById.get(b)!),
      order: Math.min(...members.map((member) => indexById.get(member)!)),
      generation: tree.nodes.find(({ id }) => id === members[0])!.metaData
        .layer,
    }))
    .sort((a, b) => a.order - b.order)
  const groupByPerson = new Map<string, SiblingGroup>()
  groups.forEach((group) =>
    group.members.forEach((personId) => groupByPerson.set(personId, group)),
  )

  const marriages = tree.edges.filter(
    (edge) =>
      edge.type === 'marriage' &&
      nodeIds.has(edge.from) &&
      nodeIds.has(edge.to),
  )
  const explicitSiblings = tree.edges.filter((edge) => edge.type === 'sibling')
  const areSiblingNeighbors = (first: string, second: string): boolean => {
    const firstParents = [...(parentByPerson.get(first) ?? [])].sort()
    const secondParents = [...(parentByPerson.get(second) ?? [])].sort()
    return (
      JSON.stringify(firstParents) === JSON.stringify(secondParents) ||
      getConnectedSiblingMembers(first, explicitSiblings).includes(second)
    )
  }

  const rowGroups = new Map<number, SiblingGroup[]>()
  for (const group of groups) {
    const row = rowGroups.get(group.generation) ?? []
    row.push(group)
    rowGroups.set(group.generation, row)
  }

  const positions: Record<string, Point> = {}
  let maxWidth = cardWidth + LAYOUT_SPACING.margin * 2
  const orderedRows = [...rowGroups.entries()].sort(([a], [b]) => a - b)

  for (const [generation, row] of orderedRows) {
    orderRowGroups(
      row,
      marriages,
      groupByPerson,
      indexById,
      parentByPerson,
      positions,
      cardWidth,
    )
    let preferredX: number = LAYOUT_SPACING.margin
    const memberBlocks = row
      .flatMap((group) =>
        splitSiblingGroup(group.members, parentByPerson, indexById).map(
          (members) => {
            const parentIds = [
              ...new Set(members.flatMap((id) => parentByPerson.get(id) ?? [])),
            ]
            const centers = parentIds
              .map((id) => positions[id])
              .filter((point): point is Point => Boolean(point))
              .map((point) => point.x + cardWidth / 2)
            return {
              members,
              parentAnchor: centers.length
                ? centers.reduce((sum, center) => sum + center, 0) /
                  centers.length
                : undefined,
              order: Math.min(...members.map((id) => indexById.get(id)!)),
            }
          },
        ),
      )
      .sort((a, b) => {
        return a.order - b.order
      })
    const plans = memberBlocks.map(({ members }, blockIndex) => {
      const parentIds = [
        ...new Set(members.flatMap((id) => parentByPerson.get(id) ?? [])),
      ]
      const parentCenters = parentIds
        .map((id) => positions[id])
        .filter((point): point is Point => Boolean(point))
        .map((point) => point.x + cardWidth / 2)
      const orderedMembers = [...members].sort(
        (a, b) => indexById.get(a)! - indexById.get(b)!,
      )
      let width = cardWidth * orderedMembers.length
      for (let index = 0; index < orderedMembers.length - 1; index += 1) {
        const first = orderedMembers[index]!
        const second = orderedMembers[index + 1]!
        width += (partnersByPerson.get(first) ?? []).includes(second)
          ? LAYOUT_SPACING.partnerGap
          : LAYOUT_SPACING.siblingGap
      }
      const desiredX = parentCenters.length
        ? parentCenters.reduce((sum, center) => sum + center, 0) /
            parentCenters.length -
          width / 2
        : preferredX
      const nextMembers = memberBlocks[blockIndex + 1]?.members
      const firstMember = orderedMembers[orderedMembers.length - 1]
      const nextMember = nextMembers?.[0]
      const gap =
        firstMember && nextMember
          ? marriages.some(
              (edge) =>
                (edge.from === firstMember && edge.to === nextMember) ||
                (edge.to === firstMember && edge.from === nextMember),
            )
            ? LAYOUT_SPACING.partnerGap
            : areSiblingNeighbors(firstMember, nextMember)
              ? LAYOUT_SPACING.siblingGap
              : LAYOUT_SPACING.blockGap
          : LAYOUT_SPACING.blockGap
      preferredX = desiredX + width + gap
      return { members: orderedMembers, width, desiredX }
    })
    const gaps = plans.map((plan, index) => {
      if (index === 0) return 0
      const previous = plans[index - 1]!
      const previousId = previous.members[previous.members.length - 1]
      const nextId = plan.members[0]
      return marriages.some(
        (edge) =>
          (edge.from === previousId && edge.to === nextId) ||
          (edge.to === previousId && edge.from === nextId),
      )
        ? LAYOUT_SPACING.partnerGap
        : previousId && nextId && areSiblingNeighbors(previousId, nextId)
          ? LAYOUT_SPACING.siblingGap
          : LAYOUT_SPACING.blockGap
    })
    const starts = placeOrderedBlocks(
      plans.map((plan) => plan.desiredX),
      plans.map((plan) => plan.width),
      gaps,
    )
    for (let groupIndex = 0; groupIndex < plans.length; groupIndex += 1) {
      const { members } = plans[groupIndex]!
      let nextX = starts[groupIndex]!
      const orderedMembers = members
      for (
        let memberIndex = 0;
        memberIndex < orderedMembers.length;
        memberIndex += 1
      ) {
        const personId = orderedMembers[memberIndex]!
        positions[personId] = {
          x: nextX,
          y:
            LAYOUT_SPACING.margin +
            generation * (CARD_HEIGHT + LAYOUT_SPACING.rowGap),
        }
        const nextPerson = orderedMembers[memberIndex + 1]
        const adjacentPartner =
          nextPerson !== undefined &&
          (partnersByPerson.get(personId) ?? []).includes(nextPerson)
        nextX +=
          cardWidth +
          (nextPerson
            ? adjacentPartner
              ? LAYOUT_SPACING.partnerGap
              : LAYOUT_SPACING.siblingGap
            : 0)
      }
    }
    maxWidth = Math.max(
      maxWidth,
      ...plans.map(
        (plan, index) => starts[index]! + plan.width + LAYOUT_SPACING.margin,
      ),
    )
  }

  const leftmost = Math.min(...Object.values(positions).map((point) => point.x))
  const horizontalShift = LAYOUT_SPACING.margin - leftmost
  for (const point of Object.values(positions)) {
    point.x += horizontalShift
  }
  maxWidth =
    Math.max(...Object.values(positions).map((point) => point.x + cardWidth)) +
    LAYOUT_SPACING.margin

  const families = collectFamilies(tree, parentByPerson, groupByPerson)
  assignLanes(families, positions, cardWidth)
  const familyLaneCounts = new Map<number, number>()
  for (const family of families) {
    familyLaneCounts.set(
      family.generation,
      Math.max(familyLaneCounts.get(family.generation) ?? 0, family.lane + 1),
    )
  }
  const marriageRouting = assignMarriageLanes(
    marriages,
    families,
    groupByPerson,
    familyLaneCounts,
    positions,
    cardWidth,
  )
  const rowTops = new Map<number, number>()
  let nextTop: number = LAYOUT_SPACING.margin
  for (
    let generation = 0;
    generation <= maxGenerationInGroups(groups);
    generation += 1
  ) {
    rowTops.set(generation, nextTop)
    nextTop +=
      CARD_HEIGHT +
      LAYOUT_SPACING.rowGap +
      (marriageRouting.laneCounts.get(generation) ?? 0) *
        LAYOUT_SPACING.laneSpacing
  }
  for (const [personId, point] of Object.entries(positions)) {
    const generation = groupByPerson.get(personId)?.generation ?? 0
    point.y = rowTops.get(generation) ?? LAYOUT_SPACING.margin
  }

  const edgePaths: LayoutLine[] = []
  const consumed = new Set<TreeEdge>()
  for (const family of families) {
    family.edges.forEach((edge) => consumed.add(edge))
    const marriage = marriages.find(
      (edge) =>
        family.parents.length === 2 &&
        samePair(edge.from, edge.to, family.parents[0]!, family.parents[1]!),
    )
    if (marriage) consumed.add(marriage)
    const representative = marriage ?? family.edges[0]
    if (!representative) continue
    const familyMarriage = marriage
    const familyPath = getFamilyPath(
      family,
      positions,
      cardWidth,
      familyMarriage,
      familyMarriage ? marriageRouting.lanes.get(familyMarriage) : undefined,
    )
    edgePaths.push({
      edge: representative,
      path: familyPath.path,
      people: [...family.parents, ...family.children],
      dots: familyPath.dots,
    })
  }

  for (const edge of marriages) {
    if (consumed.has(edge)) continue
    const from = positions[edge.from]
    const to = positions[edge.to]
    if (!from || !to) continue
    if (from.y !== to.y) {
      const upperId = from.y < to.y ? edge.from : edge.to
      const lowerId = upperId === edge.from ? edge.to : edge.from
      edgePaths.push({
        edge,
        path: getCrossLayerPath(upperId, lowerId, positions, cardWidth),
        people: [edge.from, edge.to],
        dots: [],
      })
      consumed.add(edge)
      continue
    }
    const leftId = from.x <= to.x ? edge.from : edge.to
    const rightId = leftId === edge.from ? edge.to : edge.from
    const left = positions[leftId]!
    const right = positions[rightId]!
    const hasSharedChild = (childrenByPerson.get(leftId) ?? []).some((child) =>
      (childrenByPerson.get(rightId) ?? []).includes(child),
    )
    const hasInterveningCard = Object.entries(positions).some(
      ([personId, point]) =>
        personId !== leftId &&
        personId !== rightId &&
        point.y === left.y &&
        point.x < right.x &&
        point.x + cardWidth > left.x + cardWidth,
    )
    const adjacent =
      right.x - (left.x + cardWidth) <= LAYOUT_SPACING.partnerGap &&
      !hasInterveningCard
    const lane = marriageRouting.lanes.get(edge) ?? 0
    const routeY =
      left.y +
      CARD_HEIGHT +
      LAYOUT_SPACING.lineInset +
      lane * LAYOUT_SPACING.laneSpacing
    const centerX = (left.x + cardWidth + right.x) / 2
    edgePaths.push({
      edge,
      path: adjacent
        ? `M ${left.x + cardWidth} ${left.y + CARD_HEIGHT / 2} H ${right.x}`
        : `M ${left.x + cardWidth / 2} ${left.y + CARD_HEIGHT} V ${routeY} H ${right.x + cardWidth / 2} V ${right.y + CARD_HEIGHT}`,
      people: [edge.from, edge.to],
      dots:
        hasSharedChild && adjacent
          ? [{ x: centerX, y: left.y + CARD_HEIGHT / 2 }]
          : [],
    })
  }

  addSiblingBrackets(
    tree,
    groups,
    families,
    positions,
    edgePaths,
    consumed,
    cardWidth,
  )
  for (const edge of tree.edges) {
    if (edge.type !== 'sibling' || consumed.has(edge)) continue
    const from = positions[edge.from]
    const to = positions[edge.to]
    if (!from || !to || from.y === to.y) continue
    const upperId = from.y < to.y ? edge.from : edge.to
    const lowerId = upperId === edge.from ? edge.to : edge.from
    edgePaths.push({
      edge,
      path: getCrossLayerPath(upperId, lowerId, positions, cardWidth),
      people: [edge.from, edge.to],
      dots: [],
    })
    consumed.add(edge)
  }
  for (const edge of tree.edges) {
    if (
      edge.type === 'child' ||
      edge.type === 'sibling' ||
      edge.type === 'marriage' ||
      consumed.has(edge)
    ) {
      continue
    }
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue
    const from = positions[edge.from]
    const to = positions[edge.to]
    if (!from || !to) continue
    edgePaths.push({
      edge,
      path: getUnusualEdgePath(from, to, cardWidth),
      people: [edge.from, edge.to],
      dots: [],
    })
  }

  const maxGeneration = Math.max(0, ...groups.map((group) => group.generation))
  const cardCenters = Object.fromEntries(
    Object.entries(positions).map(([id, point]) => [
      id,
      { x: point.x + cardWidth / 2, y: point.y + CARD_HEIGHT / 2 },
    ]),
  )
  const rowBands = [...rowGroups.entries()].map(([layer, row]) => {
    const personIds = row.flatMap(({ members }) => members)
    const rowPoints = personIds
      .map((id) => positions[id])
      .filter((point): point is Point => Boolean(point))
    return {
      layer,
      left: LAYOUT_SPACING.margin,
      top: Math.min(...rowPoints.map(({ y }) => y)) - 20,
      width: maxWidth - LAYOUT_SPACING.margin * 2,
      height: CARD_HEIGHT + 40,
      personIds,
    }
  })
  return {
    positions,
    cardCenters,
    rowBands,
    edgePaths,
    width: maxWidth,
    height:
      (rowTops.get(maxGeneration) ?? LAYOUT_SPACING.margin) +
      CARD_HEIGHT +
      LAYOUT_SPACING.margin,
  }
}

function shiftPathHorizontally(path: string, offset: number): string {
  const tokens = path.match(/[MHV]|-?(?:\d+\.?\d*|\.\d+)/g) ?? []
  const shifted: string[] = []
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++]!
    shifted.push(command)
    if (command === 'M') {
      shifted.push(String(Number(tokens[index++]!) + offset))
      shifted.push(tokens[index++]!)
    } else if (command === 'H') {
      shifted.push(String(Number(tokens[index++]!) + offset))
    } else if (command === 'V') {
      shifted.push(tokens[index++]!)
    } else {
      throw new Error(`Unsupported layout path command: ${command}`)
    }
  }
  return shifted.join(' ')
}

function findClearDropColumn(
  sourceX: number,
  routeY: number,
  busY: number,
  family: Family,
  positions: Record<string, Point>,
  cardWidth: number,
): number {
  const related = new Set([...family.parents, ...family.children])
  const obstacles = Object.entries(positions).filter(
    ([id, point]) =>
      !related.has(id) &&
      point.y < busY + CARD_HEIGHT &&
      point.y + CARD_HEIGHT > routeY,
  )
  const candidates = [
    sourceX,
    ...obstacles.flatMap(([, point]) => [
      point.x - LAYOUT_SPACING.lineInset,
      point.x + cardWidth + LAYOUT_SPACING.lineInset,
    ]),
  ].sort((a, b) => Math.abs(a - sourceX) - Math.abs(b - sourceX))

  for (const channelX of candidates) {
    const verticalBlocked = obstacles.some(
      ([, point]) =>
        channelX > point.x &&
        channelX < point.x + cardWidth &&
        point.y < busY &&
        point.y + CARD_HEIGHT > routeY,
    )
    const horizontalBlocked = obstacles.some(([, point]) => {
      if (routeY <= point.y || routeY >= point.y + CARD_HEIGHT) return false
      return (
        Math.max(Math.min(sourceX, channelX), point.x) <
        Math.min(Math.max(sourceX, channelX), point.x + cardWidth)
      )
    })
    if (!verticalBlocked && !horizontalBlocked) return channelX
  }
  return sourceX
}

function splitSiblingGroup(
  members: string[],
  parentByPerson: Map<string, string[]>,
  indexById: Map<string, number>,
): string[][] {
  const orderedMembers = [...members].sort(
    (a, b) => indexById.get(a)! - indexById.get(b)!,
  )
  const blocks: string[][] = []
  let currentKey: string | null = null
  let previousOrder: number | null = null
  for (const personId of orderedMembers) {
    const parents = [...(parentByPerson.get(personId) ?? [])].sort()
    const key = JSON.stringify(parents)
    const order = indexById.get(personId)!
    if (
      key !== currentKey ||
      previousOrder === null ||
      order !== previousOrder + 1
    ) {
      blocks.push([])
    }
    blocks[blocks.length - 1]!.push(personId)
    currentKey = key
    previousOrder = order
  }
  return blocks
    .map((block) => block.sort((a, b) => indexById.get(a)! - indexById.get(b)!))
    .sort(
      (a, b) => orderedMembers.indexOf(a[0]!) - orderedMembers.indexOf(b[0]!),
    )
}

function placeOrderedBlocks(
  preferredStarts: number[],
  widths: number[],
  gaps: number[],
): number[] {
  const offsets: number[] = []
  for (let index = 0; index < preferredStarts.length; index += 1) {
    offsets[index] =
      index === 0 ? 0 : offsets[index - 1]! + widths[index - 1]! + gaps[index]!
  }

  const pools: Array<{
    start: number
    end: number
    sum: number
    weight: number
  }> = []
  for (let index = 0; index < preferredStarts.length; index += 1) {
    pools.push({
      start: index,
      end: index,
      sum: preferredStarts[index]! - offsets[index]!,
      weight: 1,
    })
    while (pools.length > 1) {
      const current = pools[pools.length - 1]!
      const previous = pools[pools.length - 2]!
      if (previous.sum / previous.weight <= current.sum / current.weight) {
        break
      }
      pools.pop()
      pools.pop()
      pools.push({
        start: previous.start,
        end: current.end,
        sum: previous.sum + current.sum,
        weight: previous.weight + current.weight,
      })
    }
  }

  const starts = new Array<number>(preferredStarts.length)
  for (const pool of pools) {
    const adjusted = pool.sum / pool.weight
    for (let index = pool.start; index <= pool.end; index += 1) {
      starts[index] = adjusted + offsets[index]!
    }
  }
  return starts
}

function maxGenerationInGroups(groups: SiblingGroup[]): number {
  return Math.max(0, ...groups.map((group) => group.generation))
}

function orderRowGroups(
  row: SiblingGroup[],
  marriages: TreeEdge[],
  groupByPerson: Map<string, SiblingGroup>,
  indexById: Map<string, number>,
  parentByPerson: Map<string, string[]>,
  positions: Record<string, Point>,
  cardWidth: number,
) {
  void marriages
  void groupByPerson
  void parentByPerson
  void positions
  void cardWidth
  row.sort((a, b) => a.order - b.order)
  for (const group of row) {
    group.members.sort((a, b) => indexById.get(a)! - indexById.get(b)!)
  }
}

function collectFamilies(
  tree: FamilyTree,
  parentByPerson: Map<string, string[]>,
  groupByPerson: Map<string, SiblingGroup>,
): Family[] {
  const familyMap = new Map<string, Family>()
  for (const child of tree.nodes) {
    const parents = (parentByPerson.get(child.id) ?? []).sort()
    if (!parents.length) continue
    const key = JSON.stringify({ parents, layer: child.metaData.layer })
    const family = familyMap.get(key) ?? {
      parents,
      children: [],
      edges: [],
      generation: 0,
      lane: 0,
    }
    family.children.push(child.id)
    family.generation = Math.max(
      family.generation,
      ...parents.map((id) => groupByPerson.get(id)?.generation ?? 0),
    )
    familyMap.set(key, family)
  }
  for (const edge of tree.edges) {
    if (edge.type !== 'child') continue
    const parents = [...(parentByPerson.get(edge.to) ?? [])].sort()
    const child = tree.nodes.find(({ id }) => id === edge.to)
    const family = child
      ? familyMap.get(JSON.stringify({ parents, layer: child.metaData.layer }))
      : undefined
    if (family) family.edges.push(edge)
  }
  return [...familyMap.values()].sort((a, b) => {
    const aFirst = Math.min(
      ...a.children.map((id) => tree.nodes.findIndex((n) => n.id === id)),
    )
    const bFirst = Math.min(
      ...b.children.map((id) => tree.nodes.findIndex((n) => n.id === id)),
    )
    return a.generation - b.generation || aFirst - bFirst
  })
}

function assignLanes(
  families: Family[],
  positions: Record<string, Point>,
  cardWidth: number,
) {
  const byGeneration = new Map<number, Family[]>()
  for (const family of families) {
    const row = byGeneration.get(family.generation) ?? []
    row.push(family)
    byGeneration.set(family.generation, row)
  }
  for (const row of byGeneration.values()) {
    const laneIntervals: Array<Array<[number, number]>> = []
    const ordered = row
      .map((family) => {
        const childPoints = family.children
          .map((id) => positions[id])
          .filter((point): point is Point => Boolean(point))
        return {
          family,
          start: Math.min(
            ...family.parents.map(
              (id) => positions[id]?.x ?? Number.POSITIVE_INFINITY,
            ),
            ...childPoints.map((point) => point.x),
          ),
          end: Math.max(
            ...family.parents.map((id) => (positions[id]?.x ?? 0) + cardWidth),
            ...childPoints.map((point) => point.x + cardWidth),
          ),
        }
      })
      .sort((a, b) => a.start - b.start || a.end - b.end)
    for (const interval of ordered) {
      let lane = laneIntervals.findIndex((entries) =>
        entries.every(
          ([start, end]) => interval.end <= start || interval.start >= end,
        ),
      )
      if (lane < 0) {
        lane = laneIntervals.length
        laneIntervals.push([])
      }
      laneIntervals[lane]!.push([interval.start, interval.end])
      interval.family.lane = lane
    }
  }
}

function assignMarriageLanes(
  marriages: TreeEdge[],
  families: Family[],
  groupByPerson: Map<string, SiblingGroup>,
  familyLaneCounts: Map<number, number>,
  positions: Record<string, Point>,
  cardWidth: number,
): { lanes: Map<TreeEdge, number>; laneCounts: Map<number, number> } {
  const byGeneration = new Map<
    number,
    Array<{ edge: TreeEdge; start: number; end: number }>
  >()
  for (const edge of marriages) {
    const from = positions[edge.from]
    const to = positions[edge.to]
    if (!from || !to || from.y !== to.y) continue
    const left = from.x <= to.x ? from : to
    const right = left === from ? to : from
    if (right.x - (left.x + cardWidth) <= LAYOUT_SPACING.partnerGap) continue
    const generation = groupByPerson.get(edge.from)?.generation ?? 0
    const intervals = byGeneration.get(generation) ?? []
    intervals.push({
      edge,
      start: left.x + cardWidth / 2,
      end: right.x + cardWidth / 2,
    })
    byGeneration.set(generation, intervals)
  }

  const lanes = new Map<TreeEdge, number>()
  const laneCounts = new Map(familyLaneCounts)
  for (const [generation, intervals] of byGeneration) {
    const laneIntervals: Array<Array<[number, number]>> = []
    intervals.sort((a, b) => a.start - b.start || a.end - b.end)
    for (const interval of intervals) {
      let lane = laneIntervals.findIndex((entries) =>
        entries.every(
          ([start, end]) => interval.end <= start || interval.start >= end,
        ),
      )
      if (lane < 0) {
        lane = laneIntervals.length
        laneIntervals.push([])
      }
      laneIntervals[lane]!.push([interval.start, interval.end])
      lanes.set(interval.edge, (familyLaneCounts.get(generation) ?? 0) + lane)
    }
    laneCounts.set(
      generation,
      (familyLaneCounts.get(generation) ?? 0) + laneIntervals.length,
    )
  }

  for (const family of families) {
    const marriage = marriages.find(
      (edge) =>
        family.parents.length === 2 &&
        samePair(edge.from, edge.to, family.parents[0]!, family.parents[1]!),
    )
    if (!marriage || lanes.has(marriage)) continue
    const from = positions[marriage.from]
    const to = positions[marriage.to]
    if (!from || !to) continue
    const left = from.x <= to.x ? from : to
    const right = left === from ? to : from
    if (right.x - (left.x + cardWidth) <= LAYOUT_SPACING.partnerGap) continue
    const lane = family.lane + 1
    lanes.set(marriage, lane)
    laneCounts.set(
      family.generation,
      Math.max(laneCounts.get(family.generation) ?? 0, lane + 1),
    )
  }
  return { lanes, laneCounts }
}

function getFamilyPath(
  family: Family,
  positions: Record<string, Point>,
  cardWidth: number,
  marriage?: TreeEdge,
  marriageLane?: number,
): { path: string; dots: Point[] } {
  const parentPoints = family.parents
    .map((id) => positions[id])
    .filter((point): point is Point => Boolean(point))
  const childPoints = family.children
    .map((id) => positions[id])
    .filter((point): point is Point => Boolean(point))
    .sort((a, b) => a.x - b.x)
  if (!parentPoints.length || !childPoints.length) {
    return { path: '', dots: [] }
  }

  const parentBottom = Math.max(
    ...parentPoints.map((point) => point.y + CARD_HEIGHT),
  )
  const childTop = Math.min(...childPoints.map((point) => point.y))
  const busY = Math.max(
    parentBottom + LAYOUT_SPACING.lineInset,
    childTop -
      LAYOUT_SPACING.lineInset -
      family.lane * LAYOUT_SPACING.laneSpacing,
  )
  const childCenters = childPoints.map((point) => point.x + cardWidth / 2)
  const commands: string[] = []
  const dots: Point[] = []
  const sourceCenters: number[] = []
  const marriedParents =
    marriage && family.parents.length === 2
      ? family.parents
          .map((id) => positions[id])
          .filter((point): point is Point => Boolean(point))
          .sort((a, b) => a.x - b.x)
      : []
  if (marriedParents.length === 2) {
    const [left, right] = marriedParents
    const centerX = (left!.x + cardWidth + right!.x) / 2
    sourceCenters.push(centerX)
    const centerY = left!.y + CARD_HEIGHT / 2
    const routeY =
      parentBottom +
      LAYOUT_SPACING.lineInset +
      (marriageLane ?? family.lane) * LAYOUT_SPACING.laneSpacing
    const channelX = findClearDropColumn(
      centerX,
      routeY,
      busY,
      family,
      positions,
      cardWidth,
    )
    const adjacent =
      right!.x - (left!.x + cardWidth) <= LAYOUT_SPACING.partnerGap
    commands.push(
      adjacent
        ? `M ${left!.x + cardWidth} ${centerY} H ${right!.x}`
        : `M ${left!.x + cardWidth / 2} ${left!.y + CARD_HEIGHT} V ${routeY} H ${right!.x + cardWidth / 2} V ${right!.y + CARD_HEIGHT}`,
      adjacent
        ? `M ${centerX} ${centerY} V ${routeY}`
        : `M ${centerX} ${routeY}`,
      ...(channelX === centerX ? [] : [`H ${channelX}`]),
      `V ${busY}`,
    )
    if (adjacent) {
      dots.push({ x: centerX, y: centerY })
    } else {
      dots.push({ x: centerX, y: routeY })
    }
  } else {
    for (const parentId of family.parents) {
      const parent = positions[parentId]
      if (!parent) continue
      const centerX = parent.x + cardWidth / 2
      const routeY = parent.y + CARD_HEIGHT + LAYOUT_SPACING.lineInset
      const channelX = findClearDropColumn(
        centerX,
        routeY,
        busY,
        family,
        positions,
        cardWidth,
      )
      sourceCenters.push(channelX)
      commands.push(
        `M ${centerX} ${parent.y + CARD_HEIGHT} V ${routeY}`,
        ...(channelX === centerX ? [] : [`H ${channelX}`]),
        `V ${busY}`,
      )
    }
  }
  const busPositions = [...sourceCenters, ...childCenters]
  commands.push(
    `M ${Math.min(...busPositions)} ${busY} H ${Math.max(...busPositions)}`,
  )
  for (const child of childPoints) {
    const centerX = child.x + cardWidth / 2
    const channelX = findClearDropColumn(
      centerX,
      busY,
      child.y - LAYOUT_SPACING.lineInset,
      family,
      positions,
      cardWidth,
    )
    commands.push(
      `M ${centerX} ${busY}`,
      ...(channelX === centerX ? [] : [`H ${channelX}`]),
      ...(channelX === centerX
        ? [`V ${child.y}`]
        : [
            `V ${child.y - LAYOUT_SPACING.lineInset}`,
            `H ${centerX}`,
            `V ${child.y}`,
          ]),
    )
  }
  return { path: commands.join(' '), dots }
}

function addSiblingBrackets(
  tree: FamilyTree,
  groups: SiblingGroup[],
  families: Family[],
  positions: Record<string, Point>,
  edgePaths: LayoutLine[],
  consumed: Set<TreeEdge>,
  cardWidth: number,
) {
  const explicitEdges = tree.edges.filter((edge) => edge.type === 'sibling')
  const visited = new Set<string>()
  for (const edge of explicitEdges) {
    if (visited.has(edge.from) || visited.has(edge.to)) continue
    const group = groups.find(
      (candidate) =>
        candidate.members.includes(edge.from) &&
        candidate.members.includes(edge.to),
    )
    if (!group || group.members.length < 2) continue
    const hasSharedParentBus = families.some((family) =>
      group.members.every((id) => family.children.includes(id)),
    )
    const connected = getConnectedSiblingMembers(edge.from, explicitEdges)
    connected.forEach((id) => visited.add(id))
    if (hasSharedParentBus) continue

    const points = connected
      .map((id) => ({ id, point: positions[id] }))
      .filter((entry): entry is { id: string; point: Point } =>
        Boolean(entry.point),
      )
      .sort((a, b) => a.point.x - b.point.x)
    if (points.length < 2) continue
    const lane = edgePaths.filter(
      (line) =>
        line.edge.type === 'sibling' &&
        line.people.some((id) => points.some((point) => point.id === id)),
    ).length
    const y =
      Math.min(...points.map(({ point }) => point.y)) -
      LAYOUT_SPACING.lineInset -
      lane * LAYOUT_SPACING.laneSpacing
    const firstX = points[0]!.point.x + cardWidth / 2
    const lastX = points[points.length - 1]!.point.x + cardWidth / 2
    const commands = [`M ${firstX} ${y} H ${lastX}`]
    for (const { point } of points) {
      commands.push(`M ${point.x + cardWidth / 2} ${y} V ${point.y}`)
    }
    const representative =
      explicitEdges.find(
        (candidate) =>
          connected.includes(candidate.from) &&
          connected.includes(candidate.to),
      ) ?? edge
    explicitEdges
      .filter(
        (candidate) =>
          connected.includes(candidate.from) &&
          connected.includes(candidate.to),
      )
      .forEach((candidate) => consumed.add(candidate))
    edgePaths.push({
      edge: representative,
      path: commands.join(' '),
      people: connected,
      dots: [],
    })
  }
}

function getConnectedSiblingMembers(
  start: string,
  edges: TreeEdge[],
): string[] {
  const members = new Set([start])
  const queue = [start]
  while (queue.length) {
    const current = queue.shift()!
    for (const edge of edges) {
      const other =
        edge.from === current ? edge.to : edge.to === current ? edge.from : null
      if (other && !members.has(other)) {
        members.add(other)
        queue.push(other)
      }
    }
  }
  return [...members]
}

function getUnusualEdgePath(from: Point, to: Point, cardWidth: number): string {
  const left = from.x <= to.x ? from : to
  const right = left === from ? to : from
  if (from.y === to.y) {
    return `M ${left.x + cardWidth} ${left.y + CARD_HEIGHT / 2} H ${right.x}`
  }
  const routeY = Math.max(from.y, to.y) + CARD_HEIGHT + LAYOUT_SPACING.lineInset
  return `M ${from.x + cardWidth / 2} ${from.y + CARD_HEIGHT} V ${routeY} H ${to.x + cardWidth / 2} V ${to.y + CARD_HEIGHT}`
}

function getCrossLayerPath(
  upperId: string,
  lowerId: string,
  positions: Record<string, Point>,
  cardWidth: number,
): string {
  const upper = positions[upperId]!
  const lower = positions[lowerId]!
  const sourceX = upper.x + cardWidth / 2
  const targetX = lower.x + cardWidth / 2
  const routeY = upper.y + CARD_HEIGHT + LAYOUT_SPACING.lineInset
  const lowerRouteY = lower.y - LAYOUT_SPACING.lineInset
  const family: Family = {
    parents: [upperId],
    children: [lowerId],
    edges: [],
    generation: 0,
    lane: 0,
  }
  const channelX = findClearDropColumn(
    sourceX,
    routeY,
    lowerRouteY,
    family,
    positions,
    cardWidth,
  )
  return `M ${sourceX} ${upper.y + CARD_HEIGHT} V ${routeY} H ${channelX} V ${lowerRouteY} H ${targetX} V ${lower.y}`
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
