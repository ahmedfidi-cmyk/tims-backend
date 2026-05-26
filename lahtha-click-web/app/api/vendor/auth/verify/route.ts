import { mockVendor } from '@/lib/mock/vendor-data'

const MOCK_CODES: Record<string, string> = {}

export async function POST(req: Request) {
  const { email, code } = await req.json()

  if (!email || !code) {
    return Response.json(
      { error: 'Email and code required' },
      { status: 400 }
    )
  }

  if (!/^\d{6}$/.test(code)) {
    return Response.json({ error: 'Invalid code format' }, { status: 400 })
  }

  const payload = {
    sub: mockVendor.id,
    email,
    role: mockVendor.role,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }

  const token = Buffer.from(JSON.stringify(payload)).toString('base64')

  return Response.json({
    token,
    vendor: {
      ...mockVendor,
      email,
    },
  })
}
