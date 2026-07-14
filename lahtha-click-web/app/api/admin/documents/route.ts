import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// Compliance document review: look up a device by IMEI, then fetch its
// documents with time-limited download URLs. Both backend calls are gated by
// lahtha.document.review; the vendor session cookie is forwarded.
export async function GET(req: NextRequest) {
  const imei = req.nextUrl.searchParams.get('imei')?.trim()
  if (!imei) return NextResponse.json({ error: 'أدخل رقم IMEI' }, { status: 400 })

  const headers = backendHeaders(req)
  const lookup = await fetch(backendUrl(`/lahtha/inventory/devices/lookup?imei=${encodeURIComponent(imei)}`), {
    headers,
  }).catch(() => null)
  if (!lookup) return NextResponse.json({ error: 'backend_unreachable' }, { status: 502 })
  const found = await lookup.json().catch(() => ({}))
  if (!lookup.ok) {
    const map: Record<string, string> = {
      device_not_found: 'لا يوجد جهاز بهذا الرقم',
      invalid_imei: 'رقم IMEI غير صالح',
      forbidden: 'لا تملك صلاحية مراجعة المستندات',
      unauthenticated: 'يلزم تسجيل الدخول',
    }
    return NextResponse.json({ error: map[found?.error] ?? 'تعذّر البحث' }, { status: lookup.status })
  }

  const deviceId = found.device?.deviceId as string
  const docsRes = await fetch(backendUrl(`/lahtha/inventory/devices/${deviceId}/documents`), { headers }).catch(() => null)
  const docs = docsRes && docsRes.ok ? await docsRes.json().catch(() => ({ items: [] })) : { items: [] }

  return NextResponse.json({
    device: found.device,
    state: found.state,
    currentOwner: found.currentOwner,
    documents: docs.items ?? [],
  })
}
