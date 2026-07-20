import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// Public storefront browse — active listings with device summary. Forwards the
// discovery query (q / condition / price / sort / pagination) to the backend.
const PASS = ['q', 'condition', 'minPriceHalalat', 'maxPriceHalalat', 'sort', 'limit', 'offset']

export async function GET(req: NextRequest) {
  const qs = new URLSearchParams()
  for (const key of PASS) {
    const v = req.nextUrl.searchParams.get(key)
    if (v) qs.set(key, v)
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const r = await fetch(backendUrl(`/lahtha/listings${suffix}`), { headers: backendHeaders(req) }).catch(() => null)
  if (!r || !r.ok) return NextResponse.json({ items: [], total: 0 })
  return NextResponse.json(await r.json())
}
