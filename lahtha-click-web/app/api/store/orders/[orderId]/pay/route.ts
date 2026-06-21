import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

type Ctx = { params: Promise<{ orderId: string }> }

// Buyer pays for their own pending order (customer session). Proxies to
// POST /lahtha/orders/:orderId/pay. Auto-captured intents (dev stub) return
// status 'captured'; real providers return 'pending' + a redirectUrl.
export async function POST(req: NextRequest, ctx: Ctx) {
  const { orderId } = await ctx.params
  const r = await fetch(backendUrl(`/lahtha/orders/${orderId}/pay`), {
    method: 'POST',
    headers: backendHeaders(req),
  }).catch(() => null)
  if (!r) return NextResponse.json({ error: 'backend_unreachable' }, { status: 502 })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const map: Record<string, string> = {
      order_not_payable: 'لا يمكن دفع هذا الطلب',
      forbidden: 'يلزم تسجيل الدخول كعميل',
      unauthenticated: 'يلزم تسجيل الدخول',
      payment_not_configured: 'الدفع غير مهيأ حالياً، حاول لاحقاً',
      unknown_provider: 'مزوّد الدفع غير معروف',
    }
    return NextResponse.json({ error: map[data?.error] ?? 'تعذّر إتمام الدفع' }, { status: r.status })
  }
  // data: { status: 'captured' | 'pending', intentId, redirectUrl? }
  return NextResponse.json({ ok: true, ...data })
}
