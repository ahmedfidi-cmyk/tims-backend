'use client'

import { useEffect, useMemo, useState } from 'react'
import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import Link from 'next/link'

interface Order {
  orderId: string
  status: string
  totalHalalat: number
  commissionHalalat: number
  vendorNetHalalat: number
  createdAt: string
}

function formatSar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', {
    style: 'currency',
    currency: 'SAR',
  })
}

const OPEN_STATUSES = new Set(['AWAITING_FULFILLMENT', 'SHIPPED'])
const SETTLED_STATUSES = new Set(['COMPLETED', 'IN_CUSTODY'])
const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

export default function EarningsDashboardPage() {
  const { vendor, logout } = useVendorAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/vendor/orders', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setOrders(d.items || [])
        setPending(Boolean(d.pending))
      })
      .finally(() => setLoading(false))
  }, [])

  const settled = orders.filter((o) => SETTLED_STATUSES.has(o.status))
  const openOrders = orders.filter((o) => OPEN_STATUSES.has(o.status))
  const settledNet = settled.reduce((s, o) => s + o.vendorNetHalalat, 0)
  const pendingNet = openOrders.reduce((s, o) => s + o.vendorNetHalalat, 0)
  const avgCommission = orders.length > 0
    ? orders.reduce((s, o) => s + o.commissionHalalat, 0) / orders.length
    : 0

  const monthly = useMemo(() => {
    const byMonth = new Map<string, { label: string; amount: number; sortKey: string }>()
    for (const o of settled) {
      const d = new Date(o.createdAt)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const label = `${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`
      const existing = byMonth.get(key)
      if (existing) existing.amount += o.vendorNetHalalat
      else byMonth.set(key, { label, amount: o.vendorNetHalalat, sortKey: key })
    }
    return [...byMonth.values()].sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1)).slice(-6)
  }, [settled])
  const maxMonthly = Math.max(1, ...monthly.map((m) => m.amount))

  const recent = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      {/* Header */}
      <header className="bg-lahtha-ink text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">لوحة الأرباح</h1>
            <p className="text-ink-900/70 text-sm">{vendor?.businessName}</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-coral-500 rounded-lg hover:opacity-90"
          >
            تسجيل الخروج
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-ink-900/80 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex gap-4">
            <Link href="/vendor/dashboard" className="text-white/60 hover:text-white">
              لوحة التحكم
            </Link>
            <Link href="/vendor/orders/history" className="text-white/60 hover:text-white">
              الطلبات
            </Link>
            <Link href="/vendor/earnings/dashboard" className="text-gold-500 font-bold border-b-2 border-gold-500">
              الأرباح
            </Link>
            <Link href="/vendor/profile/settings" className="text-white/60 hover:text-white">
              الملف الشخصي
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <p className="text-center py-16 text-ink-900/60">جاري التحميل...</p>
        ) : pending ? (
          <div className="card text-center py-16">
            <p className="text-ink-900 font-bold mb-2">حسابك قيد المراجعة</p>
            <p className="text-ink-900/60 text-sm">ستظهر أرباحك هنا فور اعتماد متجرك.</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="card border-l-4 border-coral-500">
                <p className="text-ink-900/60 text-sm mb-2">الأرباح الكلية</p>
                <p className="text-3xl font-bold text-coral-500 mb-2">
                  {formatSar(settledNet + pendingNet)}
                </p>
                <p className="text-xs text-ink-900/50">منذ البداية</p>
              </div>

              <div className="card border-l-4 border-gold-500">
                <p className="text-ink-900/60 text-sm mb-2">قيد التسوية</p>
                <p className="text-3xl font-bold text-gold-500 mb-2">
                  {formatSar(pendingNet)}
                </p>
                <p className="text-xs text-ink-900/50">{openOrders.length} طلبات</p>
              </div>

              <div className="card border-l-4 border-green-500">
                <p className="text-ink-900/60 text-sm mb-2">المسدد</p>
                <p className="text-3xl font-bold text-green-600 mb-2">
                  {formatSar(settledNet)}
                </p>
                <p className="text-xs text-ink-900/50">{settled.length} طلبات</p>
              </div>

              <div className="card border-l-4 border-ink-900">
                <p className="text-ink-900/60 text-sm mb-2">متوسط العمولة</p>
                <p className="text-3xl font-bold text-ink-900 mb-2">
                  {formatSar(avgCommission)}
                </p>
                <p className="text-xs text-ink-900/50">لكل طلب</p>
              </div>
            </div>

            {/* Monthly Breakdown */}
            <div className="card mb-8">
              <h2 className="text-xl font-bold text-ink-900 mb-6">الأرباح الشهرية</h2>
              {monthly.length === 0 ? (
                <p className="text-ink-900/60 text-sm py-6 text-center">لا توجد أرباح مسدَّدة بعد.</p>
              ) : (
                <div className="space-y-4">
                  {monthly.map((m) => (
                    <div key={m.sortKey} className="flex items-center justify-between">
                      <p className="font-medium text-ink-900 w-28">{m.label}</p>
                      <div className="flex-1 ml-4 h-8 bg-ink-900/10 rounded-lg relative overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-coral-500 to-gold-500 rounded-lg transition-all"
                          style={{ width: `${(m.amount / maxMonthly) * 100}%` }}
                        />
                      </div>
                      <p className="price text-right w-40">{formatSar(m.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Commission Info */}
            <div className="card mb-8">
              <h2 className="text-xl font-bold text-ink-900 mb-4">معلومات العمولة</h2>
              <div className="bg-ink-900/5 p-4 rounded-lg">
                <p className="text-sm text-ink-900/70 mb-3">
                  ✓ تُحسب عمولة لحظة على كل طلب مسلَّم بنجاح<br/>
                  ✓ النسبة الثابتة: <span className="font-bold">5%</span> من سعر البيع<br/>
                  ✓ تُحرَّر أرباحك عند تأكيد العميل استلام الطلب<br/>
                  ✓ الأرباح المحفوظة في العهدة تظهر ضمن «قيد التسوية»
                </p>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="card">
              <h2 className="text-xl font-bold text-ink-900 mb-4">أحدث العمليات</h2>
              {recent.length === 0 ? (
                <p className="text-ink-900/60 text-sm py-6 text-center">لا توجد عمليات بعد.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-ink-900/5 border-b border-ink-900/10">
                      <tr>
                        <th className="text-right p-3 font-semibold text-ink-900">التاريخ</th>
                        <th className="text-right p-3 font-semibold text-ink-900">النوع</th>
                        <th className="text-right p-3 font-semibold text-ink-900">المبلغ</th>
                        <th className="text-right p-3 font-semibold text-ink-900">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((order) => (
                        <tr key={order.orderId} className="border-b border-ink-900/5 hover:bg-ink-900/2">
                          <td className="p-3 text-xs text-ink-900/60">
                            {new Date(order.createdAt).toLocaleDateString('ar-SA')}
                          </td>
                          <td className="p-3 font-medium text-ink-900">أرباح طلب</td>
                          <td className="p-3 price">+{formatSar(order.vendorNetHalalat)}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              SETTLED_STATUSES.has(order.status)
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {SETTLED_STATUSES.has(order.status) ? 'مسدد' : 'قيد الانتظار'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
