import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// Place an order from a listing (customer session).
export async function POST(req: NextRequest) {
  const { listingId, fulfillmentType } = await req.json().catch(() => ({}))
  const r = await fetch(backendUrl('/lahtha/orders/from-listing'), {
    method: 'POST',
    headers: backendHeaders(req),
    body: JSON.stringify({ listingId, fulfillmentType: fulfillmentType ?? 'physical_fulfillment' }),
  }).catch(() => null)
  if (!r) return NextResponse.json({ error: 'backend_unreachable' }, { status: 502 })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const map: Record<string, string> = {
      listing_unavailable: 'هذا العرض لم يعد متاحاً',
      forbidden: 'يلزم تسجيل الدخول كعميل',
      unauthenticated: 'يلزم تسجيل الدخول',
      device_unavailable: 'الجهاز غير متاح',
    }
    return NextResponse.json({ error: map[data?.error] ?? 'تعذّر إتمام الطلب' }, { status: r.status })
  }
  return NextResponse.json({ ok: true, order: data })
}

// The customer's own orders.
export async function GET(req: NextRequest) {
  const r = await fetch(backendUrl('/lahtha/orders?role=buyer'), { headers: backendHeaders(req) }).catch(() => null)
  if (!r || !r.ok) return NextResponse.json({ items: [], total: 0 })
  return NextResponse.json(await r.json())
}
