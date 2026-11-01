import { describe, expect, it } from 'vitest'
import { getExportStatus, isTreeDirty } from './exportStatus'

describe('export revision status', () => {
  it('distinguishes never exported, exported, and changed trees', () => {
    expect(getExportStatus(1, null)).toBe('never')
    expect(getExportStatus(4, 4)).toBe('done')
    expect(getExportStatus(5, 4)).toBe('dirty')
    expect(isTreeDirty(1, null)).toBe(true)
    expect(isTreeDirty(4, 4)).toBe(false)
    expect(isTreeDirty(5, 4)).toBe(true)
  })
})
