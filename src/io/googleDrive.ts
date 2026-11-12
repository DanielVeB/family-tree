import { parseTreeFileDetailed } from './importTree'
import { type FamilyTree } from '../model/tree'

export interface GoogleDriveSource {
  fileId: string
  fileName: string
  canEdit: boolean
}

export class GoogleDriveError extends Error {
  constructor(
    readonly code:
      | 'invalidLink'
      | 'authRequired'
      | 'permissionDenied'
      | 'notFound'
      | 'networkError'
      | 'invalidJson'
      | 'invalidSchema'
      | 'unknown',
  ) {
    super(code)
    this.name = 'GoogleDriveError'
  }
}

export function parseGoogleDriveFileId(link: string): string | null {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  if (host !== 'drive.google.com' && host !== 'docs.google.com') {
    return null
  }

  const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/u)
  if (pathMatch?.[1]) return pathMatch[1]

  const idFromQuery = url.searchParams.get('id')
  if (idFromQuery) return idFromQuery

  return null
}

function toGoogleDriveError(status: number): GoogleDriveError {
  if (status === 401) return new GoogleDriveError('authRequired')
  if (status === 403) return new GoogleDriveError('permissionDenied')
  if (status === 404) return new GoogleDriveError('notFound')
  return new GoogleDriveError('unknown')
}

export async function loadTreeFromGoogleDriveLink(
  link: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ source: GoogleDriveSource; tree: FamilyTree }> {
  const fileId = parseGoogleDriveFileId(link)
  if (!fileId) throw new GoogleDriveError('invalidLink')

  const metadataUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,capabilities/canEdit&supportsAllDrives=true`
  let metadataResponse: Response
  try {
    metadataResponse = await fetchImpl(metadataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new GoogleDriveError('networkError')
  }
  if (!metadataResponse.ok) throw toGoogleDriveError(metadataResponse.status)
  const metadata = (await metadataResponse.json()) as {
    name?: unknown
    capabilities?: { canEdit?: unknown }
  }

  const fileUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`
  let fileResponse: Response
  try {
    fileResponse = await fetchImpl(fileUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new GoogleDriveError('networkError')
  }
  if (!fileResponse.ok) throw toGoogleDriveError(fileResponse.status)
  const text = await fileResponse.text()
  const parsed = parseTreeFileDetailed(text)
  if (!parsed.ok) {
    throw new GoogleDriveError(
      parsed.reason === 'invalidJson' ? 'invalidJson' : 'invalidSchema',
    )
  }

  const fileName =
    typeof metadata.name === 'string' && metadata.name.trim().length > 0
      ? metadata.name
      : `google-drive-${fileId}.json`

  return {
    source: {
      fileId,
      fileName,
      canEdit: metadata.capabilities?.canEdit === true,
    },
    tree: parsed.tree,
  }
}

export async function saveTreeToGoogleDriveFile(
  fileId: string,
  accessToken: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&supportsAllDrives=true`
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json;charset=utf-8',
      },
      body: text,
    })
  } catch {
    throw new GoogleDriveError('networkError')
  }
  if (!response.ok) throw toGoogleDriveError(response.status)
}
