import { mockVendor } from '@/lib/mock/vendor-data'

export async function POST(req: Request) {
  const { email } = await req.json()

  if (!email) {
    return Response.json({ error: 'Email required' }, { status: 400 })
  }

  const mockCode = Math.floor(100000 + Math.random() * 900000).toString()

  console.log(`[Mock] Verification code for ${email}: ${mockCode}`)

  return Response.json({
    code_sent: true,
    expires_in: 300,
  })
}
