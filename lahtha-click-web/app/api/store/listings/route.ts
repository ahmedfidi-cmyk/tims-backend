import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// Public storefront browse — active listings with device summary.
export async function GET(req: NextRequest) {
  const r = await fetch(backendUrl('/lahtha/listings'), { headers: backendHeaders(req) }).catch(() => null)
  if (!r || !r.ok) return NextResponse.json({ items: [], total: 0 })
  return NextResponse.json(await r.json())
}
