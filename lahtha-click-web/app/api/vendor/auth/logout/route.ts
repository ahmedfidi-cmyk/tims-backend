import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl, copySetCookie, SESSION_COOKIE } from '@/lib/api/backend'

// Proxy: revoke the session on the backend and clear the cookie in the browser.
export async function POST(req: NextRequest) {
  const backendRes = await fetch(backendUrl('/iam/auth/logout'), {
    method: 'POST',
    headers: backendHeaders(req),
  }).catch(() => null)

  const res = NextResponse.json({ ok: true })
  if (backendRes) copySetCookie(backendRes, res.headers)
  // Belt-and-braces: clear locally regardless of backend reachability.
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0, sameSite: 'lax' })
  return res
}
