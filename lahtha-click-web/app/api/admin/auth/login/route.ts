import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Admin login reuses the email-OTP flow (admins are seeded with an identity).
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}))
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 })
  }

  const backendRes = await fetch(backendUrl('/iam/auth/otp/request-by-email'), {
    method: 'POST',
    headers: backendHeaders(req),
    body: JSON.stringify({ email, channel: 'email' }),
  })

  const data = await backendRes.json().catch(() => ({}))
  if (!backendRes.ok) {
    const error = data?.error === 'identity_not_found' ? 'لا يوجد حساب إداري بهذا البريد' : 'فشل إرسال الرمز'
    return NextResponse.json({ error }, { status: backendRes.status })
  }
  return NextResponse.json({ code_sent: true, expires_in: 300, ...(data.devCode ? { devCode: data.devCode } : {}) })
}
