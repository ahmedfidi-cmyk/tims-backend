export const mockAdmin = {
  id: 'admin_001',
  email: 'admin@lahtha.sa',
  name: 'مدير المنصة',
  role: 'super_admin' as const,
}

export interface VendorRecord {
  id: string
  businessName: string
  email: string
  status: 'active' | 'pending' | 'suspended'
  kyc_status: 'approved' | 'pending' | 'rejected' | 'not_submitted'
  total_listings: number
  total_sales: number
  joined: string
}

export const mockVendors: VendorRecord[] = [
  {
    id: 'vendor_001',
    businessName: 'Tech Warehouse SA',
    email: 'warehouse@techstore.sa',
    status: 'active',
    kyc_status: 'approved',
    total_listings: 12,
    total_sales: 24,
    joined: '2026-01-10T00:00:00Z',
  },
  {
    id: 'vendor_002',
    businessName: 'iPhone Hub',
    email: 'sales@iphonehub.sa',
    status: 'active',
    kyc_status: 'pending',
    total_listings: 5,
    total_sales: 8,
    joined: '2026-03-15T00:00:00Z',
  },
  {
    id: 'vendor_003',
    businessName: 'Apple Resellers Co.',
    email: 'info@appleresellers.sa',
    status: 'pending',
    kyc_status: 'pending',
    total_listings: 0,
    total_sales: 0,
    joined: '2026-05-20T00:00:00Z',
  },
]

export interface KycRequest {
  id: string
  vendor_id: string
  vendor_name: string
  submitted_at: string
  status: 'pending' | 'approved' | 'rejected'
  documents: {
    id_card: boolean
    cr_certificate: boolean
    selfie: boolean
  }
  bank_iban: string
}

export const mockKycRequests: KycRequest[] = [
  {
    id: 'kyc_001',
    vendor_id: 'vendor_002',
    vendor_name: 'iPhone Hub',
    submitted_at: '2026-05-24T10:00:00Z',
    status: 'pending',
    documents: { id_card: true, cr_certificate: true, selfie: true },
    bank_iban: 'SA0380000000608010167519',
  },
  {
    id: 'kyc_002',
    vendor_id: 'vendor_003',
    vendor_name: 'Apple Resellers Co.',
    submitted_at: '2026-05-25T14:30:00Z',
    status: 'pending',
    documents: { id_card: true, cr_certificate: true, selfie: false },
    bank_iban: 'SA0380000000608010167520',
  },
]

export const mockAnalytics = {
  total_gmv: 5847000,
  total_commission: 292350,
  active_vendors: 12,
  total_orders: 87,
  conversion_rate: 0.034,
  monthly_growth: [
    { month: 'يناير', gmv: 350000, orders: 12 },
    { month: 'فبراير', gmv: 480000, orders: 18 },
    { month: 'مارس', gmv: 620000, orders: 22 },
    { month: 'أبريل', gmv: 890000, orders: 28 },
    { month: 'مايو', gmv: 1250000, orders: 35 },
  ],
}
