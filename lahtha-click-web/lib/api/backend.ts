// Server-only helpers for proxying to the lahtha-click backend.
// Used by Next route handlers — never imported into client components.

import type { NextRequest } from 'next/server'

export const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'
export const SESSION_COOKIE = 'lc_session'

/** Headers for a backend call, forwarding the incoming session cookie if present. */
export function backendHeaders(req: NextRequest, extra: Record<string, string> = {}): HeadersInit {
  const session = req.cookies.get(SESSION_COOKIE)?.value
  return {
    'Content-Type': 'application/json',
    ...(session ? { cookie: `${SESSION_COOKIE}=${session}` } : {}),
    ...extra,
  }
}

/** Build a backend URL for a given path (path must start with '/'). */
export function backendUrl(path: string): string {
  return `${BACKEND_URL}${path}`
}

/** Copy the backend's Set-Cookie (lc_session) onto our outgoing response headers. */
export function copySetCookie(from: Response, to: Headers): void {
  const setCookie = from.headers.get('set-cookie')
  if (setCookie) to.set('set-cookie', setCookie)
}
