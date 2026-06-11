import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl, copySetCookie, SESSION_COOKIE } from '@/lib/api/backend'

export async function POST(req: NextRequest) {
  const backendRes = await fetch(backendUrl('/iam/auth/logout'), {
    method: 'POST',
    headers: backendHeaders(req),
  }).catch(() => null)

  const res = NextResponse.json({ ok: true })
  if (backendRes) copySetCookie(backendRes, res.headers)
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0, sameSite: 'lax' })
  return res
}
