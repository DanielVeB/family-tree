import { repairTreePositions, TreeSchema, type FamilyTree } from '../model/tree'

export type ParseTreeFileResult = { ok: true; tree: FamilyTree } | { ok: false }

export function parseTreeFile(text: string): ParseTreeFileResult {
  try {
    const parsed: unknown = JSON.parse(text)
    const result = TreeSchema.safeParse(parsed)
    return result.success
      ? { ok: true, tree: repairTreePositions(result.data) }
      : { ok: false }
  } catch {
    return { ok: false }
  }
}
