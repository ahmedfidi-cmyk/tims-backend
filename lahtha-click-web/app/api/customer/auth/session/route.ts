import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

export async function GET(req: NextRequest) {
  const r = await fetch(backendUrl('/iam/me'), { method: 'GET', headers: backendHeaders(req) })
  if (!r.ok) return NextResponse.json({ authenticated: false }, { status: 200 })
  const data = await r.json().catch(() => ({}))
  return NextResponse.json({ authenticated: true, ...data })
}
