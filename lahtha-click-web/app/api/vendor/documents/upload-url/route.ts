import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// Request a presigned upload URL for a registration document (e.g. the supplier
// invoice). The device does not exist yet, so this hits the registration-scoped
// presign endpoint (gated by lahtha.device.register). Proxies the vendor session.
export async function POST(req: NextRequest) {
  const { documentType, contentType } = await req.json().catch(() => ({}))
  const r = await fetch(backendUrl('/lahtha/inventory/documents/upload-url'), {
    method: 'POST',
    headers: backendHeaders(req),
    body: JSON.stringify({
      documentType: documentType ?? 'supplier_invoice',
      contentType: contentType ?? 'application/octet-stream',
    }),
  }).catch(() => null)
  if (!r) return NextResponse.json({ error: 'backend_unreachable' }, { status: 502 })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const map: Record<string, string> = {
      forbidden: 'حسابك غير معتمد بعد لتسجيل الأجهزة',
      unauthenticated: 'يلزم تسجيل الدخول',
      validation_error: 'نوع الملف غير صالح',
    }
    return NextResponse.json({ error: map[data?.error] ?? 'تعذّر تجهيز رفع الملف' }, { status: r.status })
  }
  // { bucket, key, url, expiresAt, stub? }
  return NextResponse.json(data)
}
