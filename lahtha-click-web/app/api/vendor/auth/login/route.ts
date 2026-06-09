import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Proxy: request an email-keyed OTP from the backend.
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
    const error = data?.error === 'identity_not_found' ? 'لا يوجد حساب بهذا البريد' : 'فشل إرسال رمز التحقق'
    return NextResponse.json({ error }, { status: backendRes.status })
  }

  // Shape expected by the login page. devCode is surfaced only in non-prod by the backend.
  return NextResponse.json({
    code_sent: true,
    expires_in: 300,
    ...(data.devCode ? { devCode: data.devCode } : {}),
  })
}
