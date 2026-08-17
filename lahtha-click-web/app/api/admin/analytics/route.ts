import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// Platform-wide sales analytics (admin dashboard). Proxies the admin session to
// GET /lahtha/admin/analytics (gated by platform.analytics.view).
export async function GET(req: NextRequest) {
  const r = await fetch(backendUrl('/lahtha/admin/analytics'), { headers: backendHeaders(req) }).catch(() => null)
  if (!r) return NextResponse.json({ error: 'backend_unreachable' }, { status: 502 })
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    const map: Record<string, string> = {
      forbidden: 'لا تملك صلاحية عرض التحليلات',
      unauthenticated: 'يلزم تسجيل الدخول',
    }
    return NextResponse.json({ error: map[data?.error] ?? 'تعذّر تحميل التحليلات' }, { status: r.status })
  }
  return NextResponse.json(await r.json())
}
