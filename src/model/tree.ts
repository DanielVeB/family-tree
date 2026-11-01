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

export type TreeOperationErrorCode =
  | 'emptyFirstName'
  | 'nameTooLong'
  | 'duplicateNode'
  | 'unknownPerson'
  | 'selfEdge'
  | 'duplicateEdge'
  | 'childCycle'

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

function makePerson(name: PersonName): PersonNode {
  const firstName = name.firstName.trim()
  const lastName = name.lastName?.trim() ?? ''
  if (!firstName) throw new TreeOperationError('emptyFirstName')
  if (firstName.length > 100 || lastName.length > 100) {
    throw new TreeOperationError('nameTooLong')
  }
  return { id: crypto.randomUUID(), data: { firstName, lastName } }
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
  relation: 'parent' | 'child' | 'sibling' | 'partner',
  name: PersonName,
): FamilyTree {
  if (!tree.nodes.some((node) => node.id === selectedId)) {
    throw new TreeOperationError('unknownPerson')
  }

  const person = makePerson(name)
  if (tree.nodes.some((node) => node.id === person.id)) {
    throw new TreeOperationError('duplicateNode')
  }
  const edge: TreeEdge =
    relation === 'parent'
      ? { from: person.id, to: selectedId, type: 'child' }
      : relation === 'child'
        ? { from: selectedId, to: person.id, type: 'child' }
        : relation === 'sibling'
          ? { from: selectedId, to: person.id, type: 'sibling' }
          : { from: selectedId, to: person.id, type: 'marriage' }

  if (edge.from === edge.to) throw new TreeOperationError('selfEdge')
  const [first, second] =
    edge.type === 'child' || edge.from < edge.to
      ? [edge.from, edge.to]
      : [edge.to, edge.from]
  if (
    tree.edges.some((existing) => {
      const [existingFirst, existingSecond] =
        existing.type === 'child' || existing.from < existing.to
          ? [existing.from, existing.to]
          : [existing.to, existing.from]
      return (
        existing.type === edge.type &&
        existingFirst === first &&
        existingSecond === second
      )
    })
  ) {
    throw new TreeOperationError('duplicateEdge')
  }

  if (
    edge.type === 'child' &&
    wouldCreateChildCycle(tree, edge.from, edge.to)
  ) {
    throw new TreeOperationError('childCycle')
  }

  return {
    ...tree,
    nodes: [...tree.nodes, person],
    edges: [...tree.edges, edge],
  }
}

function wouldCreateChildCycle(
  tree: FamilyTree,
  parentId: string,
  childId: string,
): boolean {
  const childrenByParent = new Map<string, string[]>()
  for (const edge of tree.edges) {
    if (edge.type === 'child') {
      childrenByParent.set(edge.from, [
        ...(childrenByParent.get(edge.from) ?? []),
        edge.to,
      ])
    }
  }
  const stack = [childId]
  const visited = new Set<string>()
  while (stack.length) {
    const current = stack.pop()!
    if (current === parentId) return true
    if (visited.has(current)) continue
    visited.add(current)
    stack.push(...(childrenByParent.get(current) ?? []))
  }
  return false
}

export function getPerson(
  tree: FamilyTree,
  id: string,
): PersonNode | undefined {
  return tree.nodes.find((node) => node.id === id)
}
