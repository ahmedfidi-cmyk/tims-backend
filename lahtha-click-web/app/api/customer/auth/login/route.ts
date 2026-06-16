import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}))
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) return NextResponse.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 })
  const r = await fetch(backendUrl('/iam/auth/otp/request-by-email'), {
    method: 'POST',
    headers: backendHeaders(req),
    body: JSON.stringify({ email, channel: 'email' }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const error = data?.error === 'identity_not_found' ? 'لا يوجد حساب بهذا البريد' : 'فشل إرسال الرمز'
    return NextResponse.json({ error }, { status: r.status })
  }
  return NextResponse.json({ code_sent: true, ...(data.devCode ? { devCode: data.devCode } : {}) })
}
