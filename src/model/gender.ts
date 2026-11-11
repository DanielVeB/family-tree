import names from '../config/gender-names.json'

function normalizeName(name: string): string {
  return name.normalize('NFC').trim().toLocaleLowerCase('pl')
}

function makeNameSet(values: unknown): Set<string> {
  if (!Array.isArray(values)) return new Set()
  return new Set(
    values
      .filter((name): name is string => typeof name === 'string')
      .map(normalizeName)
      .filter(Boolean),
  )
}

const maleNamesEndingInA = makeNameSet(names.maleNamesEndingInA)
const femaleNamesNotEndingInA = makeNameSet(names.femaleNamesNotEndingInA)

export type Gender = 'female' | 'male'

export function guessGender(firstName: string): Gender | undefined {
  const trimmed = firstName.trim()
  if (!trimmed) return undefined
  const firstWord = trimmed.split(/[\s-]+/u).find(Boolean) ?? trimmed
  const normalized = normalizeName(firstWord)
  if (maleNamesEndingInA.has(normalized)) return 'male'
  if (femaleNamesNotEndingInA.has(normalized)) return 'female'
  return normalized.endsWith('a') ? 'female' : 'male'
}
