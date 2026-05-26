import { mockVendors } from '@/lib/mock/admin-data'

let vendors = [...mockVendors]

export async function GET() {
  return Response.json({ items: vendors, total: vendors.length })
}

export async function PATCH(req: Request) {
  const { id, status } = await req.json()
  const idx = vendors.findIndex(v => v.id === id)
  if (idx === -1) {
    return Response.json({ error: 'Vendor not found' }, { status: 404 })
  }
  vendors[idx] = { ...vendors[idx], status }
  return Response.json({ success: true, vendor: vendors[idx] })
}
