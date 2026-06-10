import { NextResponse, type NextRequest } from 'next/server'
import { mockDevices, DeviceListing } from '@/lib/mock/devices-data'
import { backendHeaders, backendUrl } from '@/lib/api/backend'

// --- GET: real, proxied to the backend inventory (read-only listing) ---

// Map a backend inventory item ({ device, state, currentOwner, documents }) to the
// listing shape the vendor UI renders. Price lives on orders, not devices (ADR-0004),
// so it is not shown here.
function toListing(item: any): DeviceListing {
  const d = item.device ?? item
  const stateToStatus: Record<string, DeviceListing['status']> = {
    with_vendor: 'active',
    in_custody: 'sold',
    sold: 'sold',
    with_dealer: 'sold',
    unowned: 'draft',
  }
  return {
    id: d.deviceId,
    imei: d.imei,
    brand: 'Apple',
    model: d.modelName ?? d.modelCode ?? '',
    condition: d.condition ?? 'good',
    price: 0,
    description: '',
    images: [],
    status: stateToStatus[item.state as string] ?? 'draft',
    views: 0,
    created_at: typeof d.createdAt === 'string' ? d.createdAt : new Date(d.createdAt ?? Date.now()).toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const backendRes = await fetch(backendUrl('/lahtha/inventory/devices'), {
    method: 'GET',
    headers: backendHeaders(req),
  }).catch(() => null)

  // Not authenticated / not yet approved (no device.list permission) → empty state.
  if (!backendRes || !backendRes.ok) {
    return NextResponse.json({ items: [], total: 0, pending: backendRes?.status === 403 })
  }
  const data = await backendRes.json().catch(() => ({ items: [] }))
  const items = Array.isArray(data.items) ? data.items.map(toListing) : []
  return NextResponse.json({ items, total: items.length })
}

// --- POST/PATCH/DELETE: still mock (device creation/mutation deferred — needs the
// register-device form fields + invoice upload, tracked as a follow-up). ---

let devices = [...mockDevices]

export async function POST(req: Request) {
  const body = await req.json()
  const { imei, brand, model, condition, price, description } = body
  if (!imei || !brand || !model || !price) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const newDevice: DeviceListing = {
    id: `dev_${Date.now()}`,
    imei,
    brand,
    model,
    condition: condition || 'good',
    price,
    description: description || '',
    images: [],
    status: 'active',
    views: 0,
    created_at: new Date().toISOString(),
  }
  devices.push(newDevice)
  return Response.json({ success: true, device: newDevice })
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, ...updates } = body
  const idx = devices.findIndex((d) => d.id === id)
  if (idx === -1) {
    return Response.json({ error: 'Device not found' }, { status: 404 })
  }
  devices[idx] = { ...devices[idx], ...updates }
  return Response.json({ success: true, device: devices[idx] })
}

export async function DELETE(req: Request) {
  const { id } = await req.json()
  const before = devices.length
  devices = devices.filter((d) => d.id !== id)
  return Response.json({ success: true, removed: before - devices.length, total: devices.length })
}
