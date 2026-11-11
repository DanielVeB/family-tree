import { describe, expect, it, vi } from 'vitest'
import { computeLayout, LAYOUT_SPACING } from '../layout/computeLayout'
import {
  addFirstPerson,
  addRelative,
  createEmptyTree,
  deletePerson,
  getConnectionQuestions,
  getDefaultConnectionAnswers,
  getParentCount,
  TreeSchema,
  updatePerson,
  type FamilyTree,
  type RelativeKind,
} from './tree'
import { serializeTree } from '../io/exportTree'
import { parseTreeFile } from '../io/importTree'

function randomGenerator(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x1_0000_0000
  }
}

function getPathSegments(path: string) {
  const tokens = path.match(/[MHV]|-?(?:\d+\.?\d*|\.\d+)/g) ?? []
  const segments: Array<[number, number, number, number]> = []
  let x = 0
  let y = 0
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++]!
    if (command === 'M') {
      x = Number(tokens[index++]!)
      y = Number(tokens[index++]!)
    } else if (command === 'H') {
      const nextX = Number(tokens[index++]!)
      segments.push([x, y, nextX, y])
      x = nextX
    } else if (command === 'V') {
      const nextY = Number(tokens[index++]!)
      segments.push([x, y, x, nextY])
      y = nextY
    } else {
      throw new Error(`Unsupported layout path command: ${command}`)
    }
  }
  return segments
}

function runSequence(seed: number): string {
  let id = 0
  vi.stubGlobal('crypto', { randomUUID: () => `generated-${id++}` })
  const random = randomGenerator(seed)
  let tree: FamilyTree = addFirstPerson(createEmptyTree(), {
    firstName: 'Fictional 0',
  })
  let undoTree: FamilyTree | null = null
  let nextName = 1

  for (let step = 0; step < 60; step += 1) {
    const operation = Math.floor(random() * 7)
    if (tree.nodes.length === 0 || (operation <= 3 && tree.nodes.length < 25)) {
      if (tree.nodes.length === 0) {
        tree = addFirstPerson(tree, { firstName: `Fictional ${nextName++}` })
      } else {
        const selected =
          tree.nodes[Math.floor(random() * tree.nodes.length)]!.id
        const relations: RelativeKind[] = [
          'child',
          'sibling',
          'partner',
          ...(getParentCount(tree, selected) < 2 ? ['parent' as const] : []),
        ]
        const relation = relations[Math.floor(random() * relations.length)]!
        const questions = getConnectionQuestions(tree, selected, relation)
        const answers = getDefaultConnectionAnswers(questions)
        if (questions.some(({ kind }) => kind === 'choice')) {
          answers.choice = '__none__'
        }
        const detailFields =
          random() < 0.5
            ? {
                gender:
                  random() < 0.5 ? ('female' as const) : ('male' as const),
                dateOfBirth: random() < 0.5 ? '1948-03-07' : undefined,
                dateOfDeath: random() < 0.5 ? '2019' : undefined,
              }
            : {}
        tree = addRelative(
          tree,
          selected,
          relation,
          { firstName: `Fictional ${nextName++}`, ...detailFields },
          answers,
        )
      }
      undoTree = null
    } else if (operation === 4 && tree.nodes.length) {
      const selected = tree.nodes[Math.floor(random() * tree.nodes.length)]!.id
      undoTree = tree
      tree = deletePerson(tree, selected)
    } else if (operation === 5 && tree.nodes.length) {
      const selected = tree.nodes[Math.floor(random() * tree.nodes.length)]!.id
      tree = updatePerson(tree, selected, {
        firstName: `Edited ${nextName++}`,
        lastName: 'Example',
        gender: random() < 0.5 ? 'female' : 'male',
        dateOfBirth: random() < 0.5 ? '1980' : undefined,
        dateOfDeath: random() < 0.5 ? '2020-01' : undefined,
      })
      undoTree = null
    } else if (undoTree) {
      tree = undoTree
      undoTree = null
    }

    const parsed = TreeSchema.safeParse(tree)
    if (!parsed.success) {
      throw new Error(`seed ${seed}, step ${step}: invalid tree schema`)
    }
    for (const person of tree.nodes) {
      if (getParentCount(tree, person.id) > 2) {
        throw new Error(`seed ${seed}, step ${step}: too many parents`)
      }
    }
    const layout = computeLayout(tree)
    const cards = Object.entries(layout.positions)
    if (cards.length !== tree.nodes.length) {
      throw new Error(`seed ${seed}, step ${step}: layout omitted a person`)
    }
    for (let first = 0; first < cards.length; first += 1) {
      for (let second = first + 1; second < cards.length; second += 1) {
        const [, a] = cards[first]!
        const [, b] = cards[second]!
        const overlaps =
          a.x < b.x + 200 &&
          a.x + 200 > b.x &&
          a.y < b.y + LAYOUT_SPACING.cardHeight &&
          a.y + LAYOUT_SPACING.cardHeight > b.y
        if (overlaps) {
          throw new Error(`seed ${seed}, step ${step}: overlapping cards`)
        }
      }
    }
    for (const line of layout.edgePaths) {
      if (!line.path) {
        throw new Error(`seed ${seed}, step ${step}: empty relationship path`)
      }
      for (const [x1, y1, x2, y2] of getPathSegments(line.path)) {
        for (const [personId, card] of cards) {
          if (line.people.includes(personId)) continue
          const crossesCard =
            y1 === y2
              ? y1 > card.y &&
                y1 < card.y + LAYOUT_SPACING.cardHeight &&
                Math.max(Math.min(x1, x2), card.x) <
                  Math.min(Math.max(x1, x2), card.x + 200)
              : x1 > card.x &&
                x1 < card.x + 200 &&
                Math.max(Math.min(y1, y2), card.y) <
                  Math.min(Math.max(y1, y2), card.y + LAYOUT_SPACING.cardHeight)
          if (crossesCard) {
            throw new Error(
              `seed ${seed}, step ${step}: relationship line crosses unrelated ${personId}; ${JSON.stringify({ edge: line.edge, path: line.path, people: line.people, positions: layout.positions, edges: tree.edges })}`,
            )
          }
        }
      }
    }
  }
  const serialized = serializeTree(tree)
  const parsed = parseTreeFile(serialized)
  const roundTrip = parsed.ok ? serializeTree(parsed.tree) : ''
  if (!parsed.ok || roundTrip !== serialized) {
    throw new Error(`seed ${seed}: tree did not round-trip byte-identically`)
  }
  return serialized
}

describe('randomized tree operations', () => {
  it('keeps 200 seeded operation sequences valid, laid out, and repeatable', () => {
    try {
      for (let seed = 1; seed <= 200; seed += 1) {
        expect(runSequence(seed), `first result for seed ${seed}`).toBe(
          runSequence(seed),
        )
      }
    } finally {
      vi.unstubAllGlobals()
    }
  }, 30_000)
})
