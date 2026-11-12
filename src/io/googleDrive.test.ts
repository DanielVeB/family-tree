import { describe, expect, it, vi } from 'vitest'
import validTreeFile from './fixtures/valid-tree.json?raw'
import {
  loadTreeFromGoogleDriveLink,
  parseGoogleDriveFileId,
  saveTreeToGoogleDriveFile,
} from './googleDrive'

describe('parseGoogleDriveFileId', () => {
  it('extracts file ids from supported links', () => {
    expect(
      parseGoogleDriveFileId(
        'https://drive.google.com/file/d/abcDEF_123/view?usp=sharing',
      ),
    ).toBe('abcDEF_123')
    expect(
      parseGoogleDriveFileId('https://drive.google.com/open?id=xyz-987'),
    ).toBe('xyz-987')
    expect(
      parseGoogleDriveFileId('https://docs.google.com/file/d/id-from-docs/edit'),
    ).toBe('id-from-docs')
  })

  it('returns null for unsupported links', () => {
    expect(parseGoogleDriveFileId('not-a-url')).toBeNull()
    expect(parseGoogleDriveFileId('https://example.com/file/d/abc/view')).toBeNull()
    expect(parseGoogleDriveFileId('https://drive.google.com/drive/folders/1')).toBeNull()
  })
})

describe('loadTreeFromGoogleDriveLink', () => {
  it('loads metadata and tree data from Drive', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'file-1',
            name: 'Shared Tree.json',
            capabilities: { canEdit: true },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(validTreeFile, { status: 200 }))

    const result = await loadTreeFromGoogleDriveLink(
      'https://drive.google.com/file/d/file-1/view',
      'token',
      fetchImpl,
    )

    expect(result.source).toEqual({
      fileId: 'file-1',
      fileName: 'Shared Tree.json',
      canEdit: true,
    })
    expect(result.tree.nodes.length).toBeGreaterThan(0)
  })

  it.each([
    [new Response('{}', { status: 401 }), 'authRequired'],
    [new Response('{}', { status: 403 }), 'permissionDenied'],
    [new Response('{}', { status: 404 }), 'notFound'],
  ] as const)(
    'maps metadata status %s to %s',
    async (response, expectedCode) => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response)
      await expect(
        loadTreeFromGoogleDriveLink(
          'https://drive.google.com/file/d/file-1/view',
          'token',
          fetchImpl,
        ),
      ).rejects.toMatchObject({ code: expectedCode })
    },
  )

  it('fails on non-JSON and schema-invalid tree content', async () => {
    const metadata = () =>
      new Response(
        JSON.stringify({ id: 'file-1', name: 'Tree.json', capabilities: {} }),
        { status: 200 },
      )
    const nonJsonFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(new Response('<html>not json</html>', { status: 200 }))
    await expect(
      loadTreeFromGoogleDriveLink(
        'https://drive.google.com/file/d/file-1/view',
        'token',
        nonJsonFetch,
      ),
    ).rejects.toMatchObject({ code: 'invalidJson' })

    const invalidSchemaFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(new Response('{"version":1,"nodes":[]}', { status: 200 }))
    await expect(
      loadTreeFromGoogleDriveLink(
        'https://drive.google.com/file/d/file-1/view',
        'token',
        invalidSchemaFetch,
      ),
    ).rejects.toMatchObject({ code: 'invalidSchema' })
  })
})

describe('saveTreeToGoogleDriveFile', () => {
  it('saves file content through Drive upload API', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }))
    await saveTreeToGoogleDriveFile('file-id', 'token', '{"version":1}\n', fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.googleapis.com/upload/drive/v3/files/file-id?uploadType=media&supportsAllDrives=true',
      expect.objectContaining({
        method: 'PATCH',
        body: '{"version":1}\n',
      }),
    )
  })

  it.each([
    [401, 'authRequired'],
    [403, 'permissionDenied'],
  ] as const)('maps save status %i to %s', async (status, expectedCode) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status }))
    await expect(
      saveTreeToGoogleDriveFile('file-id', 'token', '{}', fetchImpl),
    ).rejects.toMatchObject({ code: expectedCode })
  })
})
