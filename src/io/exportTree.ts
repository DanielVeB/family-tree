import { TreeSchema, type FamilyTree } from '../model/tree'

export function serializeTree(tree: FamilyTree): string {
  const validatedTree = TreeSchema.parse(tree)
  return `${JSON.stringify(validatedTree, null, 2)}\n`
}

export function buildExportFilename(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `family-tree-${year}-${month}-${day}.json`
}

export function startTreeDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  try {
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 300)
  } catch (error) {
    link.remove()
    URL.revokeObjectURL(url)
    throw error
  }
}
