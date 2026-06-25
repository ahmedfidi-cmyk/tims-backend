'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'

interface Order {
  orderId: string
  status: string
  fulfillmentType: string
  totalHalalat: number
  commissionHalalat: number
  vendorNetHalalat: number
  createdAt: string
}

function formatSar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })
}

const STATUS: Record<string, { text: string; bg: string }> = {
  PENDING_PAYMENT: { text: 'بانتظار الدفع', bg: 'bg-yellow-100 text-yellow-800' },
  AWAITING_FULFILLMENT: { text: 'قيد التجهيز', bg: 'bg-orange-100 text-orange-800' },
  SHIPPED: { text: 'تم الشحن', bg: 'bg-blue-100 text-blue-800' },
  COMPLETED: { text: 'مكتمل', bg: 'bg-green-100 text-green-800' },
  IN_CUSTODY: { text: 'محفوظ رقمياً', bg: 'bg-green-100 text-green-800' },
  PAYMENT_FAILED: { text: 'فشل الدفع', bg: 'bg-red-100 text-red-800' },
  CANCELLED: { text: 'ملغى', bg: 'bg-ink-900/10 text-ink-900/70' },
  REFUNDED: { text: 'مسترجع', bg: 'bg-ink-900/10 text-ink-900/70' },
}

export default function OrdersHistoryPage() {
  const { vendor, logout } = useVendorAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent')

  useEffect(() => {
    fetch('/api/vendor/orders', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setOrders(d.items || [])
        setPending(Boolean(d.pending))
      })
      .finally(() => setLoading(false))
  }, [])

  const sorted = [...orders].sort((a, b) => {
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    return sortBy === 'recent' ? diff : -diff
  })

  const totalSales = orders.reduce((s, o) => s + o.totalHalalat, 0)
  const totalCommission = orders.reduce((s, o) => s + o.commissionHalalat, 0)
  const completed = orders.filter((o) => o.status === 'COMPLETED' || o.status === 'IN_CUSTODY').length
  const open = orders.filter((o) => o.status === 'AWAITING_FULFILLMENT' || o.status === 'SHIPPED').length

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <header className="bg-ink-900 text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">سجل الطلبات</h1>
            <p className="text-ink-900/70 text-sm">{vendor?.businessName}</p>
          </div>
          <button onClick={logout} className="px-4 py-2 bg-coral-500 rounded-lg hover:opacity-90">
            تسجيل الخروج
          </button>
        </div>
      </header>

      <nav className="bg-ink-900/80 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex gap-4">
            <Link href="/vendor/dashboard" className="text-white/60 hover:text-white">لوحة التحكم</Link>
            <Link href="/vendor/orders/history" className="text-gold-500 font-bold border-b-2 border-gold-500">الطلبات</Link>
            <Link href="/vendor/earnings/dashboard" className="text-white/60 hover:text-white">الأرباح</Link>
            <Link href="/vendor/profile/settings" className="text-white/60 hover:text-white">الملف الشخصي</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-ink-900">إجمالي الطلبات: {orders.length}</h2>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'oldest')}
            className="px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
          >
            <option value="recent">الأحدث أولاً</option>
            <option value="oldest">الأقدم أولاً</option>
          </select>
        </div>

        {loading ? (
          <p className="text-center py-12 text-ink-900/60">جاري التحميل...</p>
        ) : pending ? (
          <div className="card text-center py-12">
            <p className="text-ink-900/60">حسابك قيد المراجعة — ستظهر الطلبات بعد اعتماد المتجر.</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-ink-900/60">لا توجد طلبات بعد.</p>
          </div>
        ) : (
          <>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ink-900/5 border-b border-ink-900/10">
                    <tr>
                      <th className="text-right p-4 font-semibold text-ink-900">رقم الطلب</th>
                      <th className="text-right p-4 font-semibold text-ink-900">التاريخ</th>
                      <th className="text-right p-4 font-semibold text-ink-900">المبلغ</th>
                      <th className="text-right p-4 font-semibold text-ink-900">العمولة (5%)</th>
                      <th className="text-right p-4 font-semibold text-ink-900">صافيك</th>
                      <th className="text-right p-4 font-semibold text-ink-900">الحالة</th>
                      <th className="text-right p-4 font-semibold text-ink-900"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((o) => (
                      <tr key={o.orderId} className="border-b border-ink-900/5 hover:bg-ink-900/2 transition">
                        <td className="p-4 font-mono text-xs">{o.orderId.slice(0, 8)}</td>
                        <td className="p-4 text-xs text-ink-900/60">{new Date(o.createdAt).toLocaleDateString('ar-SA')}</td>
                        <td className="p-4 font-bold text-coral-500">{formatSar(o.totalHalalat)}</td>
                        <td className="p-4 text-ink-900/70">{formatSar(o.commissionHalalat)}</td>
                        <td className="p-4 font-bold text-gold-500">{formatSar(o.vendorNetHalalat)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS[o.status]?.bg ?? 'bg-ink-900/10'}`}>
                            {STATUS[o.status]?.text ?? o.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <Link href={`/vendor/orders/${o.orderId}`} className="text-coral-500 hover:underline text-sm">
                            تفاصيل
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
              <div className="card">
                <p className="text-ink-900/60 text-sm mb-2">إجمالي المبيعات</p>
                <p className="text-2xl font-bold text-ink-900">{formatSar(totalSales)}</p>
              </div>
              <div className="card">
                <p className="text-ink-900/60 text-sm mb-2">إجمالي العمولات</p>
                <p className="text-2xl font-bold text-coral-500">{formatSar(totalCommission)}</p>
              </div>
              <div className="card">
                <p className="text-ink-900/60 text-sm mb-2">الطلبات المكتملة</p>
                <p className="text-2xl font-bold text-ink-900">{completed}</p>
              </div>
              <div className="card">
                <p className="text-ink-900/60 text-sm mb-2">الطلبات المفتوحة</p>
                <p className="text-2xl font-bold text-ink-900">{open}</p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
