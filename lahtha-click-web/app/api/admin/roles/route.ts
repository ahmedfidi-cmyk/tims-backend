import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// Proxy the seed role catalog (public on the backend).
export async function GET(req: NextRequest) {
  const r = await fetch(backendUrl('/iam/roles'), { headers: backendHeaders(req) }).catch(() => null)
  if (!r || !r.ok) return NextResponse.json({ items: [] })
  return NextResponse.json(await r.json())
}
