import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl, copySetCookie } from '@/lib/api/backend'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const { email, code } = await req.json().catch(() => ({}))
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) return NextResponse.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 })
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return NextResponse.json({ error: 'رمز التحقق يجب أن يكون 6 أرقام' }, { status: 400 })

  const r = await fetch(backendUrl('/iam/auth/otp/verify-by-email'), {
    method: 'POST',
    headers: backendHeaders(req),
    body: JSON.stringify({ email, code }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const error = data?.error === 'otp_rejected' ? 'رمز التحقق غير صحيح أو منتهي' : 'فشل التحقق'
    return NextResponse.json({ error }, { status: r.status })
  }
  const res = NextResponse.json({ session: data.session ?? null })
  copySetCookie(r, res.headers)
  return res
}
