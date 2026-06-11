import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

type Ctx = { params: Promise<{ userId: string }> }

// Change a user's status (ACTIVATE | SUSPEND | REINSTATE | REVOKE).
export async function POST(req: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params
  const { action } = await req.json().catch(() => ({}))
  const r = await fetch(backendUrl(`/iam/users/${userId}/status`), {
    method: 'POST',
    headers: backendHeaders(req),
    body: JSON.stringify({ action }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) return NextResponse.json({ error: data?.error ?? 'request_failed' }, { status: r.status })
  return NextResponse.json(data)
}
