import { mockInventory } from '@/lib/mock/vendor-data'

let inventory = [...mockInventory]

export async function GET() {
  return Response.json({ items: inventory, total: inventory.length })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { items } = body

  if (!Array.isArray(items)) {
    return Response.json({ error: 'Invalid items array' }, { status: 400 })
  }

  const existing = new Set(inventory.map(i => i.imei))
  const added: any[] = []
  const skipped: string[] = []

  for (const item of items) {
    if (existing.has(item.imei)) {
      skipped.push(item.imei)
    } else {
      inventory.push(item)
      added.push(item)
      existing.add(item.imei)
    }
  }

  return Response.json({
    success: true,
    added: added.length,
    skipped: skipped.length,
    skippedImeis: skipped,
    total: inventory.length,
  })
}

export async function DELETE(req: Request) {
  const { imei } = await req.json()
  const before = inventory.length
  inventory = inventory.filter(i => i.imei !== imei)
  return Response.json({
    success: true,
    removed: before - inventory.length,
    total: inventory.length,
  })
}
