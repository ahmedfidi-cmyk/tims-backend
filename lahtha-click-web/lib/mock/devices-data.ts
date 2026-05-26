export interface DeviceListing {
  id: string
  imei: string
  brand: string
  model: string
  condition: 'excellent' | 'good' | 'fair' | 'poor'
  price: number
  description: string
  images: string[]
  status: 'active' | 'paused' | 'sold' | 'draft'
  views: number
  created_at: string
}

export const mockDevices: DeviceListing[] = [
  {
    id: 'dev_001',
    imei: '358240010800000',
    brand: 'Apple',
    model: 'iPhone 13',
    condition: 'excellent',
    price: 89900,
    description: 'جهاز ممتاز بحالة شبه جديدة، استخدام خفيف لمدة 6 أشهر. يأتي مع شاحن أصلي وعلبة كرتون.',
    images: [],
    status: 'active',
    views: 142,
    created_at: '2026-05-15T10:00:00Z',
  },
  {
    id: 'dev_002',
    imei: '358240010800001',
    brand: 'Apple',
    model: 'iPhone 13 Pro',
    condition: 'good',
    price: 119900,
    description: 'iPhone 13 Pro بحالة جيدة، عليه خدوش بسيطة في الجوانب. البطارية 92%.',
    images: [],
    status: 'active',
    views: 89,
    created_at: '2026-05-20T14:30:00Z',
  },
]
