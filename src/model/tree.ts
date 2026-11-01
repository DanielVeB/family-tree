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

function makePerson(name: PersonName): PersonNode {
  const normalized = normalizePersonName(name)
  return {
    id: crypto.randomUUID(),
    data: {
      firstName: normalized.firstName,
      lastName: normalized.lastName,
    },
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
  return {
    ...tree,
    nodes: tree.nodes.filter(({ id }) => id !== personId),
    edges: tree.edges.filter(
      (edge) => edge.from !== personId && edge.to !== personId,
    ),
  }
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
  return { ...tree, nodes: [...tree.nodes, person] }
}

export function addRelative(
  tree: FamilyTree,
  selectedId: string,
  relation: RelativeKind,
  name: PersonName,
  answers?: ConnectionAnswers,
): FamilyTree {
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
  return {
    ...tree,
    nodes: [...tree.nodes, person],
    edges: [...tree.edges, primaryEdge, ...extraEdges],
  }
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
