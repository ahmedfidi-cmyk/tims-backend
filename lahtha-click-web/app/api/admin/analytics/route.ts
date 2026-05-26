import { mockAnalytics } from '@/lib/mock/admin-data'

export async function GET() {
  return Response.json(mockAnalytics)
}
