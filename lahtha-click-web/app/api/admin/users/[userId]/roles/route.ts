import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

type Ctx = { params: Promise<{ userId: string }> }

// Grant a role.
export async function POST(req: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params
  const { roleId } = await req.json().catch(() => ({}))
  const r = await fetch(backendUrl(`/iam/users/${userId}/roles`), {
    method: 'POST',
    headers: backendHeaders(req),
    body: JSON.stringify({ roleId }),
  })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    return NextResponse.json({ error: d?.error ?? 'request_failed' }, { status: r.status })
  }
  return NextResponse.json({ ok: true })
}

// Revoke a role (roleId in the body).
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params
  const { roleId } = await req.json().catch(() => ({}))
  const r = await fetch(backendUrl(`/iam/users/${userId}/roles/${encodeURIComponent(roleId)}`), {
    method: 'DELETE',
    headers: backendHeaders(req),
  })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    return NextResponse.json({ error: d?.error ?? 'request_failed' }, { status: r.status })
  }
  return NextResponse.json({ ok: true })
}
