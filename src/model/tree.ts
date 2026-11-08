import { z } from 'zod'

export const RELATION_TYPES = ['child', 'sibling', 'marriage'] as const
export const RelationTypeSchema = z.enum(RELATION_TYPES)
export type RelationType = z.infer<typeof RelationTypeSchema>

const PersonDataSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().max(100).optional(),
  })
  .passthrough()

const NodeSchema = z
  .object({
    id: z.string().min(1),
    data: PersonDataSchema,
    metaData: z
      .object({
        layer: z.number().int().nonnegative(),
        order: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .passthrough()

const EdgeSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    type: RelationTypeSchema,
  })
  .passthrough()

export const TreeSchema = z
  .object({
    version: z.literal(1),
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
  })
  .passthrough()
  .superRefine((tree, context) => {
    const nodeIds = new Set<string>()
    tree.nodes.forEach((node, index) => {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'id'],
          message: 'duplicateNode',
        })
      }
      nodeIds.add(node.id)
    })

    const edgeKeys = new Set<string>()
    const childGraph = new Map<string, string[]>()
    tree.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index],
          message: 'unknownNode',
        })
      }
      if (edge.from === edge.to) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index],
          message: 'selfEdge',
        })
      }

      const [first, second] =
        edge.type === 'child' || edge.from < edge.to
          ? [edge.from, edge.to]
          : [edge.to, edge.from]
      const key = `${edge.type}\u0000${first}\u0000${second}`
      if (edgeKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index],
          message: 'duplicateEdge',
        })
      }
      edgeKeys.add(key)

      if (edge.type === 'child') {
        childGraph.set(edge.from, [
          ...(childGraph.get(edge.from) ?? []),
          edge.to,
        ])
      }
    })

    const visiting = new Set<string>()
    const visited = new Set<string>()
    const hasCycle = (id: string): boolean => {
      if (visiting.has(id)) return true
      if (visited.has(id)) return false
      visiting.add(id)
      for (const child of childGraph.get(id) ?? []) {
        if (hasCycle(child)) return true
      }
      visiting.delete(id)
      visited.add(id)
      return false
    }

    if ([...nodeIds].some(hasCycle)) {
      context.addIssue({
        code: 'custom',
        path: ['edges'],
        message: 'childCycle',
      })
    }
  })

export type PersonNode = z.infer<typeof NodeSchema>
export type TreeEdge = z.infer<typeof EdgeSchema>
export type FamilyTree = z.infer<typeof TreeSchema>

export function createEmptyTree(): FamilyTree {
  return { version: 1, nodes: [], edges: [] }
}

export function getDisplayName(person: PersonNode): string {
  return [person.data.firstName, person.data.lastName ?? '']
    .filter(Boolean)
    .join(' ')
}

export function getConnectedParts(tree: FamilyTree): string[][] {
  const adjacency = new Map(tree.nodes.map(({ id }) => [id, [] as string[]]))
  for (const edge of tree.edges) {
    adjacency.get(edge.from)?.push(edge.to)
    adjacency.get(edge.to)?.push(edge.from)
  }
  const visited = new Set<string>()
  const parts: string[][] = []
  for (const { id } of tree.nodes) {
    if (visited.has(id)) continue
    const part: string[] = []
    const queue = [id]
    visited.add(id)
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index]!
      part.push(current)
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
    parts.push(part)
  }
  return parts
}

export function repairTreePositions(tree: FamilyTree): FamilyTree {
  let changed = false
  const nodes = [...tree.nodes]
  for (const part of getConnectedParts(tree)) {
    const partSet = new Set(part)
    const partNodes = tree.nodes.filter(({ id }) => partSet.has(id))
    const layers = [
      ...new Set(partNodes.map(({ metaData }) => metaData.layer)),
    ].sort((a, b) => a - b)
    const layerMap = new Map(layers.map((layer, index) => [layer, index]))
    const byLayer = new Map<number, PersonNode[]>()
    for (const person of partNodes) {
      const layer = layerMap.get(person.metaData.layer)!
      const row = byLayer.get(layer) ?? []
      row.push(person)
      byLayer.set(layer, row)
    }
    for (const [layer, row] of byLayer) {
      row.sort(
        (a, b) =>
          a.metaData.order - b.metaData.order ||
          tree.nodes.indexOf(a) - tree.nodes.indexOf(b),
      )
      row.forEach((person, order) => {
        const index = nodes.findIndex(({ id }) => id === person.id)
        const nextLayer = layer
        if (
          person.metaData.layer !== nextLayer ||
          person.metaData.order !== order
        ) {
          changed = true
          nodes[index] = {
            ...person,
            metaData: { ...person.metaData, layer: nextLayer, order },
          }
        }
      })
    }
  }
  return changed ? { ...tree, nodes } : tree
}

export function countConnectedParts(tree: FamilyTree): number {
  return getConnectedParts(tree).length
}

export type TreeOperationErrorCode =
  | 'emptyFirstName'
  | 'nameTooLong'
  | 'duplicateNode'
  | 'unknownPerson'
  | 'selfEdge'
  | 'duplicateEdge'
  | 'childCycle'
  | 'tooManyParents'
  | 'missingConnectionChoice'
  | 'invalidConnectionAnswer'

export class TreeOperationError extends Error {
  constructor(readonly code: TreeOperationErrorCode) {
    super(code)
    this.name = 'TreeOperationError'
  }
}

export interface PersonName {
  firstName: string
  lastName?: string
}

export type RelativeKind = 'parent' | 'child' | 'sibling' | 'partner'

export type ConnectionQuestionItem = {
  personId: string
  defaultChecked: boolean
  disabledReason?: 'twoParents'
}

export type ConnectionQuestionGroup =
  | {
      id:
        | 'partnerChildren'
        | 'siblingParents'
        | 'siblingSiblings'
        | 'childSiblings'
        | 'parentSiblings'
      kind: 'checkboxes'
      items: ConnectionQuestionItem[]
    }
  | {
      id: 'childOtherParent'
      kind: 'single-checkbox' | 'choice'
      items: ConnectionQuestionItem[]
    }
  | {
      id: 'parentCouple'
      kind: 'single-checkbox'
      items: ConnectionQuestionItem[]
    }

export interface ConnectionAnswers {
  checked: Record<string, boolean>
  choice: string | null
}

export function getParentsOf(tree: FamilyTree, personId: string): string[] {
  return tree.edges
    .filter((edge) => edge.type === 'child' && edge.to === personId)
    .map((edge) => edge.from)
}

export function getChildrenOf(tree: FamilyTree, personId: string): string[] {
  return tree.edges
    .filter((edge) => edge.type === 'child' && edge.from === personId)
    .map((edge) => edge.to)
}

export function getPartnersOf(tree: FamilyTree, personId: string): string[] {
  const partners: string[] = []
  for (const edge of tree.edges) {
    if (edge.type !== 'marriage') continue
    const other =
      edge.from === personId ? edge.to : edge.to === personId ? edge.from : null
    if (other && !partners.includes(other)) partners.push(other)
  }
  return partners
}

export function getCoParentsOf(tree: FamilyTree, personId: string): string[] {
  const children = new Set(getChildrenOf(tree, personId))
  const coParents: string[] = []
  for (const edge of tree.edges) {
    if (
      edge.type === 'child' &&
      children.has(edge.to) &&
      edge.from !== personId &&
      !coParents.includes(edge.from)
    ) {
      coParents.push(edge.from)
    }
  }
  return coParents
}

export function getSiblingsOf(tree: FamilyTree, personId: string): string[] {
  const parents = new Set(getParentsOf(tree, personId))
  const siblings: string[] = []
  for (const edge of tree.edges) {
    if (edge.type === 'sibling') {
      const other =
        edge.from === personId
          ? edge.to
          : edge.to === personId
            ? edge.from
            : null
      if (other && !siblings.includes(other)) siblings.push(other)
    } else if (
      edge.type === 'child' &&
      parents.has(edge.from) &&
      edge.to !== personId &&
      !siblings.includes(edge.to)
    ) {
      siblings.push(edge.to)
    }
  }
  return siblings
}

export function getParentCount(tree: FamilyTree, personId: string): number {
  return getParentsOf(tree, personId).length
}

function getOtherParentCandidates(
  tree: FamilyTree,
  personId: string,
): string[] {
  const children = new Set(getChildrenOf(tree, personId))
  const candidates: string[] = []
  for (const edge of tree.edges) {
    let other: string | null = null
    if (edge.type === 'marriage') {
      other =
        edge.from === personId
          ? edge.to
          : edge.to === personId
            ? edge.from
            : null
    } else if (edge.type === 'child' && children.has(edge.to)) {
      other = edge.from === personId ? null : edge.from
    }
    if (other && !candidates.includes(other)) candidates.push(other)
  }
  return candidates
}

export function getConnectionQuestions(
  tree: FamilyTree,
  targetId: string,
  relation: RelativeKind,
): ConnectionQuestionGroup[] {
  if (!tree.nodes.some((node) => node.id === targetId)) {
    throw new TreeOperationError('unknownPerson')
  }
  const questions: ConnectionQuestionGroup[] = []
  const makeItems = (
    ids: string[],
    checked: boolean,
    disableAtParentLimit = false,
  ): ConnectionQuestionItem[] =>
    ids.map((personId) => {
      const disabled =
        disableAtParentLimit && getParentCount(tree, personId) >= 2
      return {
        personId,
        defaultChecked: disabled ? false : checked,
        ...(disabled ? { disabledReason: 'twoParents' as const } : {}),
      }
    })

  if (relation === 'partner') {
    const children = getChildrenOf(tree, targetId)
    if (children.length) {
      questions.push({
        id: 'partnerChildren',
        kind: 'checkboxes',
        items: makeItems(children, true, true),
      })
    }
  } else if (relation === 'child') {
    const candidates = getOtherParentCandidates(tree, targetId)
    if (candidates.length === 1) {
      questions.push({
        id: 'childOtherParent',
        kind: 'single-checkbox',
        items: makeItems(candidates, true),
      })
    } else if (candidates.length > 1) {
      questions.push({
        id: 'childOtherParent',
        kind: 'choice',
        items: makeItems(candidates, false),
      })
    }
    const siblings = getChildrenOf(tree, targetId)
    if (siblings.length) {
      questions.push({
        id: 'childSiblings',
        kind: 'checkboxes',
        items: makeItems(siblings, true),
      })
    }
  } else if (relation === 'sibling') {
    const parents = getParentsOf(tree, targetId)
    const siblings = getSiblingsOf(tree, targetId)
    if (parents.length) {
      const parentItems = makeItems(parents.slice(0, 2), true)
      if (parents.length > 2) {
        parentItems.push(
          ...parents.slice(2).map((personId) => ({
            personId,
            defaultChecked: false,
            disabledReason: 'twoParents' as const,
          })),
        )
      }
      questions.push({
        id: 'siblingParents',
        kind: 'checkboxes',
        items: parentItems,
      })
    }
    if (siblings.length) {
      questions.push({
        id: 'siblingSiblings',
        kind: 'checkboxes',
        items: makeItems(siblings, true),
      })
    }
  } else {
    if (getParentCount(tree, targetId) >= 2) {
      throw new TreeOperationError('tooManyParents')
    }
    const siblings = getSiblingsOf(tree, targetId)
    if (siblings.length) {
      questions.push({
        id: 'parentSiblings',
        kind: 'checkboxes',
        items: makeItems(siblings, true, true),
      })
    }
    const [existingParent] = getParentsOf(tree, targetId)
    if (existingParent) {
      questions.push({
        id: 'parentCouple',
        kind: 'single-checkbox',
        items: [
          {
            personId: existingParent,
            defaultChecked: getPartnersOf(tree, existingParent).length === 0,
          },
        ],
      })
    }
  }
  return questions
}

export function getDefaultConnectionAnswers(
  questions: ConnectionQuestionGroup[],
): ConnectionAnswers {
  const checked: Record<string, boolean> = {}
  for (const group of questions) {
    for (const item of group.items) {
      checked[`${group.id}:${item.personId}`] = item.defaultChecked
    }
  }
  return { checked, choice: null }
}

function normalizePersonName(name: PersonName): PersonName {
  const firstName = name.firstName.trim()
  const lastName = name.lastName?.trim() ?? ''
  if (!firstName) throw new TreeOperationError('emptyFirstName')
  if (firstName.length > 100 || lastName.length > 100) {
    throw new TreeOperationError('nameTooLong')
  }
  return { firstName, lastName }
}

function makePerson(name: PersonName, layer = 0, order = 0): PersonNode {
  const normalized = normalizePersonName(name)
  return {
    id: crypto.randomUUID(),
    data: {
      firstName: normalized.firstName,
      lastName: normalized.lastName,
    },
    metaData: { layer, order },
  }
}

export function updatePerson(
  tree: FamilyTree,
  personId: string,
  name: PersonName,
): FamilyTree {
  const personIndex = tree.nodes.findIndex(({ id }) => id === personId)
  if (personIndex === -1) throw new TreeOperationError('unknownPerson')
  const normalized = normalizePersonName(name)
  const currentPerson = tree.nodes[personIndex]!
  if (
    currentPerson.data.firstName === normalized.firstName &&
    (currentPerson.data.lastName ?? '') === normalized.lastName
  ) {
    return tree
  }
  const nodes = [...tree.nodes]
  nodes[personIndex] = {
    ...currentPerson,
    data: {
      ...currentPerson.data,
      firstName: normalized.firstName,
      lastName: normalized.lastName,
    },
  }
  return { ...tree, nodes }
}

export function deletePerson(tree: FamilyTree, personId: string): FamilyTree {
  if (!tree.nodes.some(({ id }) => id === personId)) {
    throw new TreeOperationError('unknownPerson')
  }
  return repairTreePositions({
    ...tree,
    nodes: tree.nodes.filter(({ id }) => id !== personId),
    edges: tree.edges.filter(
      (edge) => edge.from !== personId && edge.to !== personId,
    ),
  })
}

export interface DeletePreview {
  relationshipCount: number
  partCount: number
}

export function getDeletePreview(
  tree: FamilyTree,
  personId: string,
): DeletePreview {
  if (!tree.nodes.some(({ id }) => id === personId)) {
    throw new TreeOperationError('unknownPerson')
  }
  const deletedTree = deletePerson(tree, personId)
  return {
    relationshipCount: tree.edges.length - deletedTree.edges.length,
    partCount: countConnectedParts(deletedTree),
  }
}

export function addFirstPerson(tree: FamilyTree, name: PersonName): FamilyTree {
  const person = makePerson(name)
  if (tree.nodes.some((node) => node.id === person.id)) {
    throw new TreeOperationError('duplicateNode')
  }
  return {
    ...tree,
    nodes: [...tree.nodes, { ...person, metaData: { layer: 0, order: 0 } }],
  }
}

export function addRelative(
  tree: FamilyTree,
  selectedId: string,
  relation: RelativeKind,
  name: PersonName,
  answers?: ConnectionAnswers,
  centers?: Record<string, number>,
): FamilyTree {
  return addRelativeWithResult(
    tree,
    selectedId,
    relation,
    name,
    answers,
    centers,
  ).tree
}

export function addRelativeWithResult(
  tree: FamilyTree,
  selectedId: string,
  relation: RelativeKind,
  name: PersonName,
  answers?: ConnectionAnswers,
  centers?: Record<string, number>,
): { tree: FamilyTree; levelsRecalculated: boolean } {
  if (!tree.nodes.some((node) => node.id === selectedId)) {
    throw new TreeOperationError('unknownPerson')
  }

  const questions = getConnectionQuestions(tree, selectedId, relation)
  const resolvedAnswers = answers ?? getDefaultConnectionAnswers(questions)
  const person = makePerson(name)
  if (tree.nodes.some((node) => node.id === person.id)) {
    throw new TreeOperationError('duplicateNode')
  }
  const primaryEdge: TreeEdge =
    relation === 'parent'
      ? { from: person.id, to: selectedId, type: 'child' }
      : relation === 'child'
        ? { from: selectedId, to: person.id, type: 'child' }
        : relation === 'sibling'
          ? { from: selectedId, to: person.id, type: 'sibling' }
          : { from: selectedId, to: person.id, type: 'marriage' }
  const extraEdges: TreeEdge[] = []

  for (const question of questions) {
    if (question.kind === 'choice') {
      if (resolvedAnswers.choice === null) {
        throw new TreeOperationError('missingConnectionChoice')
      }
      if (resolvedAnswers.choice !== '__none__') {
        const item = question.items.find(
          ({ personId }) => personId === resolvedAnswers.choice,
        )
        if (!item || item.disabledReason) {
          throw new TreeOperationError('invalidConnectionAnswer')
        }
        extraEdges.push({
          from: item.personId,
          to: person.id,
          type: 'child',
        })
      }
      continue
    }
    for (const item of question.items) {
      if (!resolvedAnswers.checked[`${question.id}:${item.personId}`]) continue
      if (item.disabledReason) {
        throw new TreeOperationError('invalidConnectionAnswer')
      }
      if (
        question.id === 'partnerChildren' ||
        question.id === 'parentSiblings'
      ) {
        extraEdges.push({ from: person.id, to: item.personId, type: 'child' })
      } else if (
        question.id === 'childOtherParent' ||
        question.id === 'siblingParents'
      ) {
        extraEdges.push({ from: item.personId, to: person.id, type: 'child' })
      } else if (
        question.id === 'siblingSiblings' ||
        question.id === 'childSiblings'
      ) {
        extraEdges.push({
          from: person.id,
          to: item.personId,
          type: 'sibling',
        })
      } else {
        extraEdges.push({
          from: person.id,
          to: item.personId,
          type: 'marriage',
        })
      }
    }
  }

  validateNewEdges(tree, person.id, relation, [primaryEdge, ...extraEdges])
  const nodesAfterParentShift =
    relation === 'parent' && getPerson(tree, selectedId)!.metaData.layer === 0
      ? shiftPartDown(tree, selectedId)
      : tree.nodes
  const selectedAfterShift = nodesAfterParentShift.find(
    ({ id }) => id === selectedId,
  )!
  const layer =
    relation === 'parent'
      ? Math.max(0, selectedAfterShift.metaData.layer - 1)
      : relation === 'child'
        ? Math.max(
            ...[
              selectedId,
              ...extraEdges
                .filter(
                  (edge) => edge.type === 'child' && edge.to === person.id,
                )
                .map(({ from }) => from),
            ].map(
              (id) =>
                nodesAfterParentShift.find(({ id: nodeId }) => nodeId === id)
                  ?.metaData.layer ?? 0,
            ),
          ) + 1
        : selectedAfterShift.metaData.layer
  const insertionOrder = getRelativeInsertionOrder(
    { ...tree, nodes: nodesAfterParentShift },
    selectedId,
    relation,
    layer,
    extraEdges,
    centers,
  )
  const nodes = insertPersonAtOrder(
    nodesAfterParentShift,
    person,
    layer,
    insertionOrder,
  )
  let result = {
    ...tree,
    nodes,
    edges: [...tree.edges, primaryEdge, ...extraEdges],
  }
  const levelsRecalculated = hasLayerViolation(result)
  if (levelsRecalculated) result = assignLayers(result)
  return { tree: result, levelsRecalculated }
}

export interface MoveLevelAvailability {
  layer: number
  onlyThisPersonValid: boolean
  withConnectedPeopleValid: boolean
}

export interface MoveRequest {
  personId: string
  targetLayer: number
  dx: number
  moveConnected: boolean
  centers?: Record<string, number>
}

export function getConnectedPeople(
  tree: FamilyTree,
  personId: string,
): string[] {
  if (!tree.nodes.some(({ id }) => id === personId)) {
    throw new TreeOperationError('unknownPerson')
  }
  const ancestors = new Set<string>()
  const descendants = new Set<string>()
  const collect = (
    startId: string,
    direction: 'parents' | 'children',
    result: Set<string>,
  ) => {
    const queue = [startId]
    while (queue.length) {
      const current = queue.shift()!
      const next = tree.edges
        .filter(
          (edge) =>
            edge.type === 'child' &&
            (direction === 'parents'
              ? edge.to === current
              : edge.from === current),
        )
        .map((edge) => (direction === 'parents' ? edge.from : edge.to))
      for (const id of next) {
        if (result.has(id)) continue
        result.add(id)
        queue.push(id)
      }
    }
  }
  collect(personId, 'parents', ancestors)
  collect(personId, 'children', descendants)
  const connected = new Set([personId, ...ancestors, ...descendants])
  const partnerQueue = [...connected]
  while (partnerQueue.length) {
    const current = partnerQueue.shift()!
    for (const partner of getPartnersOf(tree, current)) {
      if (connected.has(partner)) continue
      connected.add(partner)
      partnerQueue.push(partner)
    }
  }
  return tree.nodes.filter(({ id }) => connected.has(id)).map(({ id }) => id)
}

function isLayerMoveValid(
  tree: FamilyTree,
  movedIds: Set<string>,
  delta: number,
): boolean {
  if (delta === 0) return true
  const layers = new Map(
    tree.nodes.map(({ id, metaData }) => [
      id,
      metaData.layer + (movedIds.has(id) ? delta : 0),
    ]),
  )
  if ([...layers.values()].some((layer) => layer < 0)) return false
  if ([...layers].some(([id, layer]) => movedIds.has(id) && layer < 0)) {
    return false
  }
  return tree.edges.every((edge) => {
    if (edge.type !== 'child') return true
    if (movedIds.has(edge.from) === movedIds.has(edge.to)) return true
    return (layers.get(edge.from) ?? 0) < (layers.get(edge.to) ?? 0)
  })
}

export function getMoveLevelAvailability(
  tree: FamilyTree,
  personId: string,
): MoveLevelAvailability[] {
  const person = getPerson(tree, personId)
  if (!person) throw new TreeOperationError('unknownPerson')
  const partIds = new Set(
    getConnectedParts(tree).find((ids) => ids.includes(personId)) ?? [],
  )
  const levels = [
    ...new Set(
      tree.nodes
        .filter(({ id }) => partIds.has(id))
        .map(({ metaData }) => metaData.layer),
    ),
  ].sort((a, b) => a - b)
  const connected = new Set(getConnectedPeople(tree, personId))
  return levels.map((layer) => {
    const delta = layer - person.metaData.layer
    return {
      layer,
      onlyThisPersonValid: isLayerMoveValid(tree, new Set([personId]), delta),
      withConnectedPeopleValid: isLayerMoveValid(tree, connected, delta),
    }
  })
}

export function moveSelection(
  tree: FamilyTree,
  request: MoveRequest,
): FamilyTree {
  const person = getPerson(tree, request.personId)
  if (!person) throw new TreeOperationError('unknownPerson')
  const delta = request.targetLayer - person.metaData.layer
  const connected = new Set(getConnectedPeople(tree, request.personId))
  const moved = request.moveConnected ? connected : new Set([request.personId])
  if (!isLayerMoveValid(tree, moved, delta)) {
    throw new TreeOperationError('invalidConnectionAnswer')
  }

  const shifted = tree.nodes.map((node) =>
    moved.has(node.id)
      ? {
          ...node,
          metaData: { ...node.metaData, layer: node.metaData.layer + delta },
        }
      : node,
  )
  const movedPart = new Set(
    getConnectedParts(tree).find((ids) => ids.includes(request.personId)) ?? [],
  )
  const ordered = [...shifted]
  for (const part of getConnectedParts({ ...tree, nodes: shifted })) {
    if (![...part].some((id) => movedPart.has(id))) continue
    const rows = new Map<number, PersonNode[]>()
    for (const node of shifted) {
      if (!part.includes(node.id)) continue
      const row = rows.get(node.metaData.layer) ?? []
      row.push(node)
      rows.set(node.metaData.layer, row)
    }
    for (const [layer, row] of rows) {
      row.sort((a, b) => {
        const aX =
          (request.centers?.[a.id] ?? a.metaData.order) +
          (moved.has(a.id) ? request.dx : 0)
        const bX =
          (request.centers?.[b.id] ?? b.metaData.order) +
          (moved.has(b.id) ? request.dx : 0)
        return (
          aX - bX ||
          a.metaData.order - b.metaData.order ||
          tree.nodes.findIndex(({ id }) => id === a.id) -
            tree.nodes.findIndex(({ id }) => id === b.id)
        )
      })
      row.forEach((node, order) => {
        const index = ordered.findIndex(({ id }) => id === node.id)
        ordered[index] = {
          ...node,
          metaData: { ...node.metaData, layer, order },
        }
      })
    }
  }
  const result = repairTreePositions({ ...tree, nodes: ordered })
  return result.nodes.every(
    ({ id, metaData }) =>
      metaData.layer === getPerson(tree, id)?.metaData.layer &&
      metaData.order === getPerson(tree, id)?.metaData.order,
  )
    ? tree
    : result
}

function shiftPartDown(tree: FamilyTree, personId: string): PersonNode[] {
  const part = new Set(
    getConnectedParts(tree).find((ids) => ids.includes(personId)) ?? [],
  )
  return tree.nodes.map((person) =>
    part.has(person.id)
      ? {
          ...person,
          metaData: { ...person.metaData, layer: person.metaData.layer + 1 },
        }
      : person,
  )
}

function getRelativeInsertionOrder(
  tree: FamilyTree,
  selectedId: string,
  relation: RelativeKind,
  layer: number,
  extraEdges: TreeEdge[],
  centers?: Record<string, number>,
): number {
  const row = tree.nodes
    .filter(({ metaData }) => metaData.layer === layer)
    .sort((a, b) => a.metaData.order - b.metaData.order)
  const selected = row.findIndex(({ id }) => id === selectedId)
  const centerOf = (id: string) =>
    centers?.[id] ??
    row.find(({ id: rowId }) => rowId === id)?.metaData.order ??
    0
  const orderAtX = (x: number) => {
    const index = row.findIndex((person) => centerOf(person.id) > x)
    return index < 0 ? row.length : index
  }
  const safeOrderAtX = (x: number) => {
    let order = orderAtX(x)
    for (let index = 0; index < row.length - 1; index += 1) {
      if (order !== index + 1) continue
      const first = row[index]!
      const second = row[index + 1]!
      if (
        !getPartnersOf(tree, first.id).includes(second.id) &&
        !getSiblingsOf(tree, first.id).includes(second.id)
      ) {
        continue
      }
      order =
        Math.abs(x - centerOf(first.id)) <= Math.abs(centerOf(second.id) - x)
          ? index
          : index + 2
      break
    }
    return order
  }
  if (relation === 'child') {
    const parents = new Set([
      selectedId,
      ...extraEdges
        .filter((edge) => edge.type === 'child' && edge.to !== selectedId)
        .map(({ from }) => from),
    ])
    const existingChildren = tree.nodes
      .filter((person) => {
        const existingParents = getParentsOf(tree, person.id)
        return (
          existingParents.length === parents.size &&
          existingParents.every((id) => parents.has(id))
        )
      })
      .map(({ id }) => id)
    const lastChild = row
      .filter((person) => existingChildren.includes(person.id))
      .sort((a, b) => centerOf(a.id) - centerOf(b.id))
      .at(-1)
    if (lastChild) return safeOrderAtX(centerOf(lastChild.id) + 1)
    const parentCenters = [...parents]
      .map((id) => centers?.[id])
      .filter((center): center is number => center !== undefined)
    return parentCenters.length
      ? safeOrderAtX(
          parentCenters.reduce((sum, center) => sum + center, 0) /
            parentCenters.length,
        )
      : row.length
  }
  if (relation === 'partner') {
    const selectedPartners = getPartnersOf(tree, selectedId)
      .filter((id) => row.some((person) => person.id === id))
      .sort((a, b) => centerOf(a) - centerOf(b))
    const left = selectedPartners.filter(
      (id) => centerOf(id) < centerOf(selectedId),
    )
    const right = selectedPartners.filter(
      (id) => centerOf(id) > centerOf(selectedId),
    )
    if (left.length && right.length)
      return orderAtX(centerOf(right.at(-1)!) + 1)
    if (right.length) return selected
    return orderAtX(centerOf(selectedId) + 1)
  }
  if (relation === 'parent') {
    const existingParent = getParentsOf(tree, selectedId)[0]
    return existingParent
      ? orderAtX(centerOf(existingParent) + 1)
      : safeOrderAtX(centerOf(selectedId))
  }
  const run = new Set([selectedId, ...getSiblingsOf(tree, selectedId)])
  const lastMember = row
    .filter(({ id }) => run.has(id))
    .sort((a, b) => centerOf(a.id) - centerOf(b.id))
    .at(-1)
  if (!lastMember) return orderAtX(centerOf(selectedId) + 1)
  const lastPartner = getPartnersOf(tree, lastMember.id)
    .filter((id) => row.some((person) => person.id === id))
    .sort((a, b) => centerOf(a) - centerOf(b))
    .filter((id) => centerOf(id) > centerOf(lastMember.id))
    .at(-1)
  return orderAtX(centerOf(lastPartner ?? lastMember.id) + 1)
}

function insertPersonAtOrder(
  existing: PersonNode[],
  person: PersonNode,
  layer: number,
  order: number,
): PersonNode[] {
  const row = existing
    .filter(({ metaData }) => metaData.layer === layer)
    .sort((a, b) => a.metaData.order - b.metaData.order)
  const clampedOrder = Math.max(0, Math.min(order, row.length))
  const rowIds = new Set(row.map(({ id }) => id))
  const orderedRow = [...row]
  orderedRow.splice(clampedOrder, 0, {
    ...person,
    metaData: { ...person.metaData, layer, order: clampedOrder },
  })
  const normalizedRow = orderedRow.map((item, index) => ({
    ...item,
    metaData: { ...item.metaData, order: index },
  }))
  const normalizedById = new Map(normalizedRow.map((item) => [item.id, item]))
  const output = existing.map((item) =>
    rowIds.has(item.id) ? normalizedById.get(item.id)! : item,
  )
  output.push(normalizedById.get(person.id)!)
  return output
}

function hasLayerViolation(tree: FamilyTree): boolean {
  const byId = new Map(tree.nodes.map((person) => [person.id, person]))
  return tree.edges.some(
    (edge) =>
      edge.type === 'child' &&
      (byId.get(edge.from)?.metaData.layer ?? 0) >=
        (byId.get(edge.to)?.metaData.layer ?? 0),
  )
}

export function assignLayers(tree: FamilyTree): FamilyTree {
  const nodes = tree.nodes.map((person) => ({
    ...person,
    metaData: { ...person.metaData },
  }))
  const ids = nodes.map(({ id }) => id)
  const parentMap = new Map(ids.map((id) => [id, [] as string[]]))
  for (const edge of tree.edges) {
    if (edge.type === 'child') parentMap.get(edge.to)?.push(edge.from)
  }
  const isAncestor = (ancestor: string, descendant: string): boolean => {
    const pending = [...(parentMap.get(descendant) ?? [])]
    const seen = new Set<string>()
    while (pending.length) {
      const current = pending.pop()!
      if (current === ancestor) return true
      if (seen.has(current)) continue
      seen.add(current)
      pending.push(...(parentMap.get(current) ?? []))
    }
    return false
  }
  const groups = new Map(ids.map((id) => [id, new Set([id])]))
  const root = new Map(ids.map((id) => [id, id]))
  const find = (id: string): string => {
    const parent = root.get(id) ?? id
    if (parent === id) return id
    const found = find(parent)
    root.set(id, found)
    return found
  }
  for (const edge of tree.edges) {
    if (edge.type === 'child') continue
    const first = find(edge.from)
    const second = find(edge.to)
    if (first === second) continue
    const firstMembers = groups.get(first) ?? new Set([first])
    const secondMembers = groups.get(second) ?? new Set([second])
    const wouldJoinAncestors = [...firstMembers].some((a) =>
      [...secondMembers].some((b) => isAncestor(a, b) || isAncestor(b, a)),
    )
    if (wouldJoinAncestors) continue
    const keep = ids.indexOf(first) <= ids.indexOf(second) ? first : second
    const merge = keep === first ? second : first
    root.set(merge, keep)
    groups.set(keep, new Set([...firstMembers, ...secondMembers]))
    groups.delete(merge)
  }
  const membersByGroup = new Map<string, string[]>()
  for (const id of ids) {
    const key = find(id)
    const members = membersByGroup.get(key) ?? []
    members.push(id)
    membersByGroup.set(key, members)
  }
  const parentsByGroup = new Map(
    [...membersByGroup.keys()].map((id) => [id, new Set<string>()]),
  )
  for (const edge of tree.edges) {
    if (edge.type !== 'child') continue
    const parent = find(edge.from)
    const child = find(edge.to)
    if (parent !== child) parentsByGroup.get(child)?.add(parent)
  }
  const layerByGroup = new Map<string, number>()
  const layerFor = (group: string, active = new Set<string>()): number => {
    if (layerByGroup.has(group)) return layerByGroup.get(group)!
    if (active.has(group)) return 0
    active.add(group)
    const parents = [...(parentsByGroup.get(group) ?? [])]
    const layer = parents.length
      ? Math.max(...parents.map((parent) => layerFor(parent, active))) + 1
      : 0
    active.delete(group)
    layerByGroup.set(group, layer)
    return layer
  }
  for (const group of membersByGroup.keys()) layerFor(group)

  const groupsInReverseDepth = [...membersByGroup.keys()].sort(
    (a, b) => layerByGroup.get(b)! - layerByGroup.get(a)!,
  )
  const childrenByGroup = new Map(
    [...membersByGroup.keys()].map((id) => [id, new Set<string>()]),
  )
  for (const [child, parents] of parentsByGroup) {
    for (const parent of parents) childrenByGroup.get(parent)?.add(child)
  }
  for (const parent of groupsInReverseDepth) {
    const children = [...(childrenByGroup.get(parent) ?? [])]
    if (!children.length) continue
    const earliestAllowed = Math.max(
      0,
      ...[...(parentsByGroup.get(parent) ?? [])].map(
        (ancestor) => (layerByGroup.get(ancestor) ?? 0) + 1,
      ),
    )
    const latestAllowed = Math.min(
      ...children.map((child) => (layerByGroup.get(child) ?? 1) - 1),
    )
    layerByGroup.set(parent, Math.max(earliestAllowed, latestAllowed))
  }
  const byId = new Map(nodes.map((person) => [person.id, person]))
  for (const [group, members] of membersByGroup) {
    const layer = layerByGroup.get(group) ?? 0
    for (const id of members) byId.get(id)!.metaData.layer = layer
  }
  return repairTreePositions({ ...tree, nodes })
}

function validateNewEdges(
  tree: FamilyTree,
  newPersonId: string,
  relation: RelativeKind,
  edges: TreeEdge[],
): void {
  const parentCounts = new Map<string, number>()
  for (const edge of tree.edges) {
    if (edge.type === 'child') {
      parentCounts.set(edge.to, (parentCounts.get(edge.to) ?? 0) + 1)
    }
  }
  const edgeKeys = new Set(tree.edges.map(getEdgeKey))
  for (const edge of edges) {
    if (
      edge.from === edge.to ||
      (edge.from !== newPersonId &&
        !tree.nodes.some((node) => node.id === edge.from)) ||
      (edge.to !== newPersonId &&
        !tree.nodes.some((node) => node.id === edge.to))
    ) {
      throw new TreeOperationError(
        edge.from === edge.to ? 'selfEdge' : 'invalidConnectionAnswer',
      )
    }
    const key = getEdgeKey(edge)
    if (edgeKeys.has(key)) throw new TreeOperationError('duplicateEdge')
    edgeKeys.add(key)
    if (edge.type === 'child') {
      const parentCount = (parentCounts.get(edge.to) ?? 0) + 1
      if (parentCount > 2) throw new TreeOperationError('tooManyParents')
      parentCounts.set(edge.to, parentCount)
    }
  }
  if (relation === 'parent' && (parentCounts.get(edges[0]!.to) ?? 0) > 2) {
    throw new TreeOperationError('tooManyParents')
  }
}

function getEdgeKey(edge: TreeEdge): string {
  const [first, second] =
    edge.type === 'child' || edge.from < edge.to
      ? [edge.from, edge.to]
      : [edge.to, edge.from]
  return `${edge.type}\u0000${first}\u0000${second}`
}

export function getPerson(
  tree: FamilyTree,
  id: string,
): PersonNode | undefined {
  return tree.nodes.find((node) => node.id === id)
}
