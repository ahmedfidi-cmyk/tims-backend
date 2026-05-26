'use client'

import { useEffect, useState } from 'react'
import { AdminNav } from '@/components/AdminNav'
import { VendorRecord } from '@/lib/mock/admin-data'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-SA')
}

const STATUS_LABELS: Record<string, { ar: string; color: string }> = {
  active: { ar: 'نشط', color: 'bg-green-100 text-green-800' },
  pending: { ar: 'معلق', color: 'bg-yellow-100 text-yellow-800' },
  suspended: { ar: 'موقوف', color: 'bg-red-100 text-red-800' },
}

const KYC_LABELS: Record<string, { ar: string; color: string }> = {
  approved: { ar: 'مقبول', color: 'text-green-700' },
  pending: { ar: 'قيد المراجعة', color: 'text-yellow-700' },
  rejected: { ar: 'مرفوض', color: 'text-red-700' },
  not_submitted: { ar: 'لم يُقدّم', color: 'text-ink-900/60' },
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<VendorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const fetchVendors = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/vendors')
      const data = await res.json()
      setVendors(data.items || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVendors() }, [])

  const handleStatusChange = async (id: string, status: string) => {
    await fetch('/api/admin/vendors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    fetchVendors()
  }

  const filtered = vendors.filter(v =>
    !filter ||
    v.businessName.toLowerCase().includes(filter.toLowerCase()) ||
    v.email.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="card mb-6">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="🔍 ابحث باسم أو بريد البائع..."
            className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
          />
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <p className="text-center py-12 text-ink-900/60">جاري التحميل...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-900/5 border-b border-ink-900/10">
                  <tr>
                    <th className="text-right p-4 font-semibold">اسم البائع</th>
                    <th className="text-right p-4 font-semibold">البريد</th>
                    <th className="text-right p-4 font-semibold">الحالة</th>
                    <th className="text-right p-4 font-semibold">التحقق</th>
                    <th className="text-right p-4 font-semibold">الإعلانات</th>
                    <th className="text-right p-4 font-semibold">المبيعات</th>
                    <th className="text-right p-4 font-semibold">انضم</th>
                    <th className="text-right p-4 font-semibold">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(v => (
                    <tr key={v.id} className="border-b border-ink-900/5 hover:bg-ink-900/2">
                      <td className="p-4 font-medium">{v.businessName}</td>
                      <td className="p-4 text-xs text-ink-900/70">{v.email}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_LABELS[v.status].color}`}>
                          {STATUS_LABELS[v.status].ar}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-medium ${KYC_LABELS[v.kyc_status].color}`}>
                          {KYC_LABELS[v.kyc_status].ar}
                        </span>
                      </td>
                      <td className="p-4 text-center">{v.total_listings}</td>
                      <td className="p-4 text-center font-bold">{v.total_sales}</td>
                      <td className="p-4 text-xs text-ink-900/60">{formatDate(v.joined)}</td>
                      <td className="p-4">
                        <select
                          value={v.status}
                          onChange={(e) => handleStatusChange(v.id, e.target.value)}
                          className="text-xs border border-ink-900/20 rounded px-2 py-1"
                        >
                          <option value="active">تفعيل</option>
                          <option value="pending">تعليق</option>
                          <option value="suspended">إيقاف</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
