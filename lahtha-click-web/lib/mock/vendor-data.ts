import type { Vendor } from '../contexts/vendor-auth-context'

export const mockVendor: Vendor = {
  id: 'vendor_001',
  email: 'warehouse@techstore.sa',
  role: 'warehouse_manager',
  businessName: 'Tech Warehouse SA',
  warehouse: {
    address: 'الرياض، حي الروضة',
    lat: 24.7136,
    lng: 46.6753,
  },
  kyc: {
    status: 'approved',
    verified_at: '2026-01-15T10:30:00Z',
  },
  commission_rate: 0.05,
}

export const mockInventory = [
  {
    imei: '358240010800000',
    brand: 'Apple',
    model: 'iPhone 13',
    condition: 'excellent',
    price: 89900,
    stock: 5,
  },
  {
    imei: '358240010800001',
    brand: 'Apple',
    model: 'iPhone 13 Pro',
    condition: 'good',
    price: 119900,
    stock: 3,
  },
  {
    imei: '358240010800002',
    brand: 'Apple',
    model: 'iPhone 12',
    condition: 'excellent',
    price: 69900,
    stock: 7,
  },
  {
    imei: '358240010800003',
    brand: 'Apple',
    model: 'iPad Air',
    condition: 'good',
    price: 179900,
    stock: 2,
  },
]

export const mockOrders = [
  {
    id: 'order_001',
    device_imei: '358240010800000',
    customer_name: 'محمد علي',
    status: 'delivered',
    amount: 89900,
    commission: 4495,
    created_at: '2026-05-20T10:00:00Z',
  },
  {
    id: 'order_002',
    device_imei: '358240010800001',
    customer_name: 'فاطمة سالم',
    status: 'pending',
    amount: 119900,
    commission: 5995,
    created_at: '2026-05-25T14:30:00Z',
  },
  {
    id: 'order_003',
    device_imei: '358240010800002',
    customer_name: 'عبدالعزيز محمد',
    status: 'shipped',
    amount: 69900,
    commission: 3495,
    created_at: '2026-05-24T09:15:00Z',
  },
]

export const mockEarnings = {
  total_commission: 234750,
  pending: 9490,
  settled: 225260,
  monthly_breakdown: [
    { month: 'يناير', amount: 15000 },
    { month: 'فبراير', amount: 22500 },
    { month: 'مارس', amount: 18750 },
    { month: 'أبريل', amount: 25000 },
    { month: 'مايو', amount: 153500 },
  ],
}
