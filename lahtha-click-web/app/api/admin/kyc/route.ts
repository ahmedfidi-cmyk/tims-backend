import { mockKycRequests } from '@/lib/mock/admin-data'

let kycRequests = [...mockKycRequests]

export async function GET() {
  return Response.json({ items: kycRequests, total: kycRequests.length })
}

export async function PATCH(req: Request) {
  const { id, status } = await req.json()
  if (!['approved', 'rejected'].includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }
  const idx = kycRequests.findIndex(k => k.id === id)
  if (idx === -1) {
    return Response.json({ error: 'KYC request not found' }, { status: 404 })
  }
  kycRequests[idx] = { ...kycRequests[idx], status }
  return Response.json({ success: true, request: kycRequests[idx] })
}
