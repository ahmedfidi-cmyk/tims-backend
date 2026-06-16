import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Customer self-registration → provisions a customer principal (active + customer.standard).
export async function POST(req: NextRequest) {
  const { name, email, phone } = await req.json().catch(() => ({}))
  if (typeof name !== 'string' || name.trim().length < 2) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) return NextResponse.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 })
  if (typeof phone !== 'string' || !/^\+?[1-9]\d{7,14}$/.test(phone)) return NextResponse.json({ error: 'رقم الجوال غير صحيح' }, { status: 400 })

  const r = await fetch(backendUrl('/iam/vendors'), {
    method: 'POST',
    headers: backendHeaders(req),
    body: JSON.stringify({ businessName: name.trim(), email, phone, principalType: 'customer' }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const error = data?.error === 'identity_conflict' ? 'هذا البريد مسجّل مسبقاً' : 'تعذّر إنشاء الحساب'
    return NextResponse.json({ error }, { status: r.status })
  }
  return NextResponse.json({ ok: true })
}
