import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// Model-code catalog for the device-registration form (public reference data).
export async function GET(req: NextRequest) {
  const r = await fetch(backendUrl('/lahtha/inventory/models'), { headers: backendHeaders(req) }).catch(() => null)
  if (!r || !r.ok) return NextResponse.json({ items: [] })
  return NextResponse.json(await r.json())
}
