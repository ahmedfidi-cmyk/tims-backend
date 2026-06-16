import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

type Ctx = { params: Promise<{ listingId: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const { listingId } = await ctx.params
  const r = await fetch(backendUrl(`/lahtha/listings/${listingId}`), { headers: backendHeaders(req) }).catch(() => null)
  if (!r) return NextResponse.json({ error: 'backend_unreachable' }, { status: 502 })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) return NextResponse.json({ error: data?.error ?? 'not_found' }, { status: r.status })
  return NextResponse.json(data)
}
