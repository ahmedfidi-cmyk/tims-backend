import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// Proxy the admin user list (users with roles), forwarding filters + cookie.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const qs = new URLSearchParams()
  const pt = url.searchParams.get('principalType')
  const st = url.searchParams.get('status')
  if (pt) qs.set('principalType', pt)
  if (st) qs.set('status', st)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''

  const r = await fetch(backendUrl(`/iam/admin/users${suffix}`), { headers: backendHeaders(req) }).catch(() => null)
  if (!r || !r.ok) return NextResponse.json({ items: [], total: 0, forbidden: r?.status === 403 })
  return NextResponse.json(await r.json())
}
