import { mockDevices } from '@/lib/mock/devices-data'

export async function GET() {
  const publicDevices = mockDevices.filter(d => d.status === 'active')
  return Response.json({ items: publicDevices, total: publicDevices.length })
}
