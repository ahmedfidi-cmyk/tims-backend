import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// Admin oversight: a newest-first page of all registered devices. Proxies the
// admin session to GET /lahtha/inventory/admin/devices (gated by device.audit).
export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get('limit') ?? '25'
  const offset = req.nextUrl.searchParams.get('offset') ?? '0'
  const r = await fetch(
    backendUrl(`/lahtha/inventory/admin/devices?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`),
    { headers: backendHeaders(req) },
  ).catch(() => null)
  if (!r) return NextResponse.json({ error: 'backend_unreachable' }, { status: 502 })
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    const map: Record<string, string> = {
      forbidden: 'لا تملك صلاحية عرض الأجهزة',
      unauthenticated: 'يلزم تسجيل الدخول',
    }
    return NextResponse.json({ error: map[data?.error] ?? 'تعذّر تحميل الأجهزة' }, { status: r.status })
  }
  return NextResponse.json(await r.json())
}
