import { NextResponse, type NextRequest } from 'next/server'
import { backendHeaders, backendUrl } from '@/lib/api/backend'
import type { KycRequest } from '@/lib/mock/admin-data'

// The "KYC" queue is the vendor-approval review queue. The backend stores a
// single ownershipProofRef rather than the granular id_card/CR/selfie checklist,
// so document flags reflect "proof submitted" (gap flagged in ADR/plan).
const STATES: Array<[string, KycRequest['status']]> = [
  ['PENDING_REVIEW', 'pending'],
  ['LAHTHA_APPROVED', 'approved'],
  ['REJECTED', 'rejected'],
]

function toRequest(v: any, status: KycRequest['status']): KycRequest {
  const hasProof = !!v.ownershipProofRef
  return {
    id: v.vendorId,
    vendor_id: v.vendorId,
    vendor_name: v.name,
    submitted_at: typeof v.createdAt === 'string' ? v.createdAt : new Date(v.createdAt ?? Date.now()).toISOString(),
    status,
    documents: { id_card: hasProof, cr_certificate: hasProof, selfie: false },
    bank_iban: v.ownershipProofRef ?? '—',
  }
}

export async function GET(req: NextRequest) {
  const headers = backendHeaders(req)
  const all = await Promise.all(
    STATES.map(async ([backendStatus, uiStatus]) => {
      const r = await fetch(backendUrl(`/lahtha/admin/vendors?status=${backendStatus}`), { headers }).catch(() => null)
      if (!r || !r.ok) return []
      const data = await r.json().catch(() => ({ items: [] }))
      return Array.isArray(data.items) ? data.items.map((v: any) => toRequest(v, uiStatus)) : []
    }),
  )
  const items = all.flat()
  return NextResponse.json({ items, total: items.length })
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json().catch(() => ({}))
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  const path = status === 'approved' ? `/lahtha/admin/vendors/${id}/approve` : `/lahtha/admin/vendors/${id}/reject`
  const body = status === 'rejected' ? JSON.stringify({ reason: 'Rejected by admin' }) : undefined
  const r = await fetch(backendUrl(path), {
    method: 'POST',
    headers: backendHeaders(req),
    ...(body ? { body } : {}),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) return NextResponse.json({ error: data?.error ?? 'request_failed' }, { status: r.status })
  return NextResponse.json({ success: true, request: data })
}
