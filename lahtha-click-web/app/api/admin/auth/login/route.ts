import { mockAdmin } from '@/lib/mock/admin-data'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEMO_PASSWORD = 'admin123'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return Response.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 })
  }

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return Response.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 })
  }

  if (password !== DEMO_PASSWORD) {
    return Response.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 })
  }

  const payload = {
    sub: mockAdmin.id,
    email,
    role: mockAdmin.role,
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000,
  }
  const token = Buffer.from(JSON.stringify(payload)).toString('base64')

  return Response.json({
    token,
    admin: { ...mockAdmin, email },
  })
}
