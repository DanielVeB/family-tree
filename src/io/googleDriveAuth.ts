export class GoogleDriveAuthError extends Error {
  constructor(
    readonly code:
      | 'notConfigured'
      | 'popupBlocked'
      | 'cancelled'
      | 'authFailed'
      | 'timeout',
  ) {
    super(code)
    this.name = 'GoogleDriveAuthError'
  }
}

export interface GoogleDriveAuthToken {
  accessToken: string
  expiresAt: number
}

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const AUTH_MESSAGE_TYPE = 'family-tree-google-drive-auth'

export async function signInToGoogleDrive(
  clientId: string | undefined,
  baseUrl: string,
): Promise<GoogleDriveAuthToken> {
  if (!clientId) throw new GoogleDriveAuthError('notConfigured')

  const redirectUri = `${window.location.origin}${baseUrl}oauth-callback.html`
  const state = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'token')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', DRIVE_SCOPE)
  authUrl.searchParams.set('include_granted_scopes', 'true')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('prompt', 'consent')

  const popup = window.open(
    authUrl.toString(),
    'google-drive-auth',
    'popup=yes,width=520,height=640',
  )
  if (!popup) throw new GoogleDriveAuthError('popupBlocked')

  return new Promise<GoogleDriveAuthToken>((resolve, reject) => {
    let timeoutId = 0
    let intervalId = 0

    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
      try {
        popup.close()
      } catch {
        // no-op
      }
    }

    const finishWithError = (error: GoogleDriveAuthError) => {
      cleanup()
      reject(error)
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const payload = event.data as
        | { type?: unknown; hash?: unknown }
        | null
        | undefined
      if (
        !payload ||
        payload.type !== AUTH_MESSAGE_TYPE ||
        typeof payload.hash !== 'string'
      ) {
        return
      }
      const params = new URLSearchParams(payload.hash.replace(/^#/u, ''))
      if (params.get('state') !== state) {
        finishWithError(new GoogleDriveAuthError('authFailed'))
        return
      }
      if (params.get('error')) {
        finishWithError(new GoogleDriveAuthError('authFailed'))
        return
      }
      const accessToken = params.get('access_token')
      const expiresIn = Number.parseInt(params.get('expires_in') ?? '3600', 10)
      if (!accessToken || Number.isNaN(expiresIn) || expiresIn <= 0) {
        finishWithError(new GoogleDriveAuthError('authFailed'))
        return
      }
      cleanup()
      resolve({
        accessToken,
        expiresAt: Date.now() + expiresIn * 1000,
      })
    }

    window.addEventListener('message', onMessage)
    timeoutId = window.setTimeout(() => {
      finishWithError(new GoogleDriveAuthError('timeout'))
    }, 120_000)
    intervalId = window.setInterval(() => {
      if (popup.closed) {
        finishWithError(new GoogleDriveAuthError('cancelled'))
      }
    }, 250)
  })
}
