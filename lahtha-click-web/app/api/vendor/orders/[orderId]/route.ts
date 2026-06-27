import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

type Ctx = { params: Promise<{ orderId: string }> }

// A single order — backend authorizes buyer or selling vendor only.
export async function GET(req: NextRequest, ctx: Ctx) {
  const { orderId } = await ctx.params
  const r = await fetch(backendUrl(`/lahtha/orders/${orderId}`), {
    headers: backendHeaders(req),
  }).catch(() => null)
  if (!r) return NextResponse.json({ error: 'backend_unreachable' }, { status: 502 })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) return NextResponse.json({ error: data?.error ?? 'not_found' }, { status: r.status })
  return NextResponse.json(data)
}
