import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'
import type { VendorRecord } from '@/lib/mock/admin-data'

const STATES = ['PENDING_OWNERSHIP_PROOF', 'PENDING_REVIEW', 'LAHTHA_APPROVED', 'REJECTED'] as const

function mapStatus(s: string): VendorRecord['status'] {
  if (s === 'LAHTHA_APPROVED') return 'active'
  if (s === 'REJECTED') return 'suspended'
  return 'pending'
}
function mapKyc(s: string): VendorRecord['kyc_status'] {
  if (s === 'LAHTHA_APPROVED') return 'approved'
  if (s === 'PENDING_REVIEW') return 'pending'
  if (s === 'REJECTED') return 'rejected'
  return 'not_submitted'
}
function toRecord(v: any): VendorRecord {
  return {
    id: v.vendorId,
    businessName: v.name,
    email: v.contactEmail,
    status: mapStatus(v.status),
    kyc_status: mapKyc(v.status),
    total_listings: 0,
    total_sales: 0,
    joined: typeof v.createdAt === 'string' ? v.createdAt : new Date(v.createdAt ?? Date.now()).toISOString(),
  }
}

// GET: merge the per-status review queues into the admin vendor table.
export async function GET(req: NextRequest) {
  const headers = backendHeaders(req)
  const all = await Promise.all(
    STATES.map(async (status) => {
      const r = await fetch(backendUrl(`/lahtha/admin/vendors?status=${status}`), { headers }).catch(() => null)
      if (!r || !r.ok) return []
      const data = await r.json().catch(() => ({ items: [] }))
      return Array.isArray(data.items) ? data.items.map(toRecord) : []
    }),
  )
  const items = all.flat()
  return NextResponse.json({ items, total: items.length })
}

// PATCH: map the UI status dropdown to an approve/reject action.
export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json().catch(() => ({}))
  if (!id || typeof status !== 'string') {
    return NextResponse.json({ error: 'id and status required' }, { status: 400 })
  }
  let path: string | null = null
  let body: Record<string, unknown> | undefined
  if (status === 'active') path = `/lahtha/admin/vendors/${id}/approve`
  else if (status === 'suspended') { path = `/lahtha/admin/vendors/${id}/reject`; body = { reason: 'Suspended by admin' } }
  else return NextResponse.json({ error: 'unsupported status transition' }, { status: 400 })

  const r = await fetch(backendUrl(path), {
    method: 'POST',
    headers: backendHeaders(req),
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) return NextResponse.json({ error: data?.error ?? 'request_failed' }, { status: r.status })
  return NextResponse.json({ success: true, vendor: data })
}
