export type ExportStatus = 'never' | 'dirty' | 'done'

export function getExportStatus(
  revision: number,
  exportedRevision: number | null,
): ExportStatus {
  if (exportedRevision === null) return 'never'
  return revision === exportedRevision ? 'done' : 'dirty'
}

export function isTreeDirty(
  revision: number,
  exportedRevision: number | null,
): boolean {
  return getExportStatus(revision, exportedRevision) !== 'done'
}
