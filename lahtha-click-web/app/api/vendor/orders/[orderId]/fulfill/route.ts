import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

type Ctx = { params: Promise<{ orderId: string }> }

// Selling vendor ships their own order (AWAITING_FULFILLMENT → SHIPPED).
// Proxies to POST /lahtha/orders/:orderId/fulfill (gated by lahtha.order.fulfill).
export async function POST(req: NextRequest, ctx: Ctx) {
  const { orderId } = await ctx.params
  const { shippingRef } = await req.json().catch(() => ({}))
  const r = await fetch(backendUrl(`/lahtha/orders/${orderId}/fulfill`), {
    method: 'POST',
    headers: backendHeaders(req),
    body: JSON.stringify({ shippingRef }),
  }).catch(() => null)
  if (!r) return NextResponse.json({ error: 'backend_unreachable' }, { status: 502 })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const map: Record<string, string> = {
      forbidden: 'لا يمكنك شحن هذا الطلب',
      unauthenticated: 'يلزم تسجيل الدخول',
      invalid_order_transition: 'لا يمكن شحن الطلب في هذه الحالة',
      validation_error: 'رقم الشحنة مطلوب',
      order_not_found: 'الطلب غير موجود',
    }
    return NextResponse.json({ error: map[data?.error] ?? 'تعذّر شحن الطلب' }, { status: r.status })
  }
  return NextResponse.json({ ok: true, ...data })
}
