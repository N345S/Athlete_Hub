// Empty means "same address as the web app": the Vite server forwards /api to the .NET API (vite.config.js),
// which is what lets phones on the same Wi-Fi use the app. Set VITE_API_BASE_URL when the API lives elsewhere.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// Fired when the API rejects the stored token so the app can sign the user out.
export const UNAUTHORIZED_EVENT = 'athletehub:unauthorized'

async function send(endpoint, { method = 'GET', body, token, raw = false } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch {
    throw new Error('We cannot connect right now. Check your internet connection and try again.')
  }

  if (response.status === 401 && token) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
  }

  if (raw && response.ok) return response

  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.message || friendlyStatus(response.status))
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

// Used when the server sends no message of its own. Written for anyone: no codes or technical words.
function friendlyStatus(status) {
  if (status === 400) return 'Some of the information is missing or not right. Please check and try again.'
  if (status === 401) return 'You have been signed out. Please sign in again.'
  if (status === 403) return 'You are not allowed to do this.'
  if (status === 404) return 'We could not find what you were looking for. It may have been deleted.'
  if (status === 409) return 'This was already changed by someone else. Please reload the page and try again.'
  if (status === 413) return 'The file is too big. Please choose a smaller file.'
  if (status === 429) return 'You tried too many times. Please wait a minute and try again.'
  if (status >= 500) return 'Something went wrong on our side. Please try again in a moment.'
  return 'Something went wrong. Please try again.'
}

export const api = {
  get: (endpoint, token) => send(endpoint, { token }),
  post: (endpoint, body, token) => send(endpoint, { method: 'POST', body, token }),
  put: (endpoint, body, token) => send(endpoint, { method: 'PUT', body, token }),
  del: (endpoint, token) => send(endpoint, { method: 'DELETE', token }),
}

/**
 * Downloads an authorized file and opens it in a new tab. Files are never public,
 * so a plain link would not carry the sign-in token.
 */
export async function openProtectedFile(endpoint, token) {
  // Open synchronously so pop-up blockers treat it as a user action.
  const tab = window.open('', '_blank')
  try {
    const response = await send(endpoint, { token, raw: true })
    const url = URL.createObjectURL(await response.blob())
    if (tab) tab.location.href = url
    else window.location.assign(url)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error) {
    tab?.close()
    throw error
  }
}

/** Fetches an authorized file as an object URL for inline previews (caller revokes it). */
export async function fetchFileUrl(endpoint, token) {
  const response = await send(endpoint, { token, raw: true })
  return URL.createObjectURL(await response.blob())
}

/** Reads the expiry (ms since epoch) from a JWT, or null when it cannot be decoded. */
export function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}
