import { repairTreePositions, TreeSchema, type FamilyTree } from '../model/tree'

export type ParseTreeFileResult = { ok: true; tree: FamilyTree } | { ok: false }
export type ParseTreeFileDetailedResult =
  | { ok: true; tree: FamilyTree }
  | { ok: false; reason: 'invalidJson' | 'invalidSchema' }

export function parseTreeFileDetailed(text: string): ParseTreeFileDetailedResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'invalidJson' }
  }
  const result = TreeSchema.safeParse(parsed)
  return result.success
    ? { ok: true, tree: repairTreePositions(result.data) }
    : { ok: false, reason: 'invalidSchema' }
}

export function parseTreeFile(text: string): ParseTreeFileResult {
  const result = parseTreeFileDetailed(text)
  return result.ok ? result : { ok: false }
}
