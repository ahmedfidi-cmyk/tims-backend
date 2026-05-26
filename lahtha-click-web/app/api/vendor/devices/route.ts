import { mockDevices, DeviceListing } from '@/lib/mock/devices-data'

let devices = [...mockDevices]

export async function GET() {
  return Response.json({ items: devices, total: devices.length })
}

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

  const idx = devices.findIndex(d => d.id === id)
  if (idx === -1) {
    return Response.json({ error: 'Device not found' }, { status: 404 })
  }

  devices[idx] = { ...devices[idx], ...updates }
  return Response.json({ success: true, device: devices[idx] })
}

export async function DELETE(req: Request) {
  const { id } = await req.json()
  const before = devices.length
  devices = devices.filter(d => d.id !== id)
  return Response.json({
    success: true,
    removed: before - devices.length,
    total: devices.length,
  })
}
