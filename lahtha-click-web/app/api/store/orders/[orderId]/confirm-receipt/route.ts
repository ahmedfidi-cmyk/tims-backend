import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

type Ctx = { params: Promise<{ orderId: string }> }

// Buyer confirms receipt of their own shipped order (customer session).
// Proxies to POST /lahtha/orders/:orderId/confirm-receipt (SHIPPED → COMPLETED).
export async function POST(req: NextRequest, ctx: Ctx) {
  const { orderId } = await ctx.params
  const r = await fetch(backendUrl(`/lahtha/orders/${orderId}/confirm-receipt`), {
    method: 'POST',
    headers: backendHeaders(req),
  }).catch(() => null)
  if (!r) return NextResponse.json({ error: 'backend_unreachable' }, { status: 502 })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const map: Record<string, string> = {
      forbidden: 'لا يمكنك تأكيد استلام هذا الطلب',
      unauthenticated: 'يلزم تسجيل الدخول',
      invalid_order_transition: 'لا يمكن تأكيد الاستلام في هذه الحالة',
      order_not_found: 'الطلب غير موجود',
    }
    return NextResponse.json({ error: map[data?.error] ?? 'تعذّر تأكيد الاستلام' }, { status: r.status })
  }
  return NextResponse.json({ ok: true, ...data })
}
