import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// The vendor's own orders (orders for devices they sell). Proxies the session to
// GET /lahtha/orders?role=vendor. Returns an empty list when not yet approved.
export async function GET(req: NextRequest) {
  const r = await fetch(backendUrl('/lahtha/orders?role=vendor'), {
    headers: backendHeaders(req),
  }).catch(() => null)
  if (!r || !r.ok) return NextResponse.json({ items: [], total: 0, pending: r?.status === 403 })
  return NextResponse.json(await r.json())
}
