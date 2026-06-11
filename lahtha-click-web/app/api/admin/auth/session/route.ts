import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// Whoami for the admin: proxy /iam/me so the client hydrates from the cookie.
export async function GET(req: NextRequest) {
  const backendRes = await fetch(backendUrl('/iam/me'), {
    method: 'GET',
    headers: backendHeaders(req),
  })
  if (!backendRes.ok) {
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
  const data = await backendRes.json().catch(() => ({}))
  return NextResponse.json({ authenticated: true, ...data })
}
