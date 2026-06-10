import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// Whoami: proxy the backend /iam/me (session + principal roles/status) so the
// client can hydrate auth state from the HttpOnly cookie it cannot read.
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
