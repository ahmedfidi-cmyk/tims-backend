'use client'

import { useEffect, useState } from 'react'
import { AdminNav } from '@/components/AdminNav'

interface MonthlyGrowth {
  month: string // "YYYY-MM"
  gmv: number
  orders: number
}
interface Analytics {
  totalGmvHalalat: number
  totalCommissionHalalat: number
  totalOrders: number
  successfulOrders: number
  activeVendors: number
  monthlyGrowth: MonthlyGrowth[]
}

function formatSar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })
}

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]
function monthLabel(ym: string) {
  const [year, month] = ym.split('-').map(Number)
  return `${AR_MONTHS[(month ?? 1) - 1] ?? ym} ${year}`
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/analytics', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
  }, [])

  if (error) return <><AdminNav /><p className="text-center py-12 text-ink-900/60">{error}</p></>
  if (!data) return <><AdminNav /><p className="text-center py-12">جاري التحميل...</p></>

  const completionRate = data.totalOrders > 0 ? data.successfulOrders / data.totalOrders : 0
  const avgOrderValue = data.successfulOrders > 0 ? data.totalGmvHalalat / data.successfulOrders : 0
  const maxGmv = Math.max(1, ...data.monthlyGrowth.map((m) => m.gmv))
  const maxOrders = Math.max(1, ...data.monthlyGrowth.map((m) => m.orders))

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-ink-900 mb-6">📊 التحليلات الكاملة</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">معدل إتمام الطلبات</p>
            <p className="text-3xl font-bold text-ink-900">{(completionRate * 100).toFixed(1)}%</p>
            <p className="text-xs text-ink-900/50 mt-2">{data.successfulOrders} من {data.totalOrders} طلب</p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">متوسط قيمة الطلب</p>
            <p className="text-3xl font-bold text-coral-500">{formatSar(avgOrderValue)}</p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">إجمالي العمولات</p>
            <p className="text-3xl font-bold text-gold-500">{formatSar(data.totalCommissionHalalat)}</p>
          </div>
        </div>

        {data.monthlyGrowth.length === 0 ? (
          <div className="card text-center py-12"><p className="text-ink-900/60">لا توجد مبيعات مكتملة بعد لعرض الاتجاه الشهري.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-bold text-ink-900 mb-4">المبيعات الشهرية</h3>
              <div className="space-y-2">
                {data.monthlyGrowth.map((m) => (
                  <div key={m.month}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{monthLabel(m.month)}</span>
                      <span className="font-bold">{formatSar(m.gmv)}</span>
                    </div>
                    <div className="h-2 bg-ink-900/10 rounded overflow-hidden">
                      <div className="h-full bg-coral-500" style={{ width: `${(m.gmv / maxGmv) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-bold text-ink-900 mb-4">الطلبات الشهرية</h3>
              <div className="space-y-2">
                {data.monthlyGrowth.map((m) => (
                  <div key={m.month}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{monthLabel(m.month)}</span>
                      <span className="font-bold">{m.orders} طلب</span>
                    </div>
                    <div className="h-2 bg-ink-900/10 rounded overflow-hidden">
                      <div className="h-full bg-gold-500" style={{ width: `${(m.orders / maxOrders) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
