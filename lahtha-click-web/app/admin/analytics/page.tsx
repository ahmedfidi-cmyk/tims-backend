'use client'

import { useEffect, useState } from 'react'
import { AdminNav } from '@/components/AdminNav'

function formatSar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch('/api/admin/analytics').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <><AdminNav /><p className="text-center py-12">جاري التحميل...</p></>

  return (
    <div className="min-h-screen bg-paper-50">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-ink-900 mb-6">📊 التحليلات الكاملة</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">معدل التحويل</p>
            <p className="text-3xl font-bold text-ink-900">{(data.conversion_rate * 100).toFixed(1)}%</p>
            <p className="text-xs text-ink-900/50 mt-2">زائر → عملية شراء</p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">متوسط قيمة الطلب</p>
            <p className="text-3xl font-bold text-coral-500">
              {formatSar(Math.floor(data.total_gmv / data.total_orders))}
            </p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">عمولة شهرية متوقعة</p>
            <p className="text-3xl font-bold text-gold-500">
              {formatSar(Math.floor(data.total_commission / 5))}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-bold text-ink-900 mb-4">المبيعات الشهرية</h3>
            <div className="space-y-2">
              {data.monthly_growth.map((m: any) => {
                const max = Math.max(...data.monthly_growth.map((x: any) => x.gmv))
                return (
                  <div key={m.month}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{m.month}</span>
                      <span className="font-bold">{formatSar(m.gmv)}</span>
                    </div>
                    <div className="h-2 bg-ink-900/10 rounded overflow-hidden">
                      <div className="h-full bg-coral-500" style={{ width: `${(m.gmv / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <h3 className="font-bold text-ink-900 mb-4">الطلبات الشهرية</h3>
            <div className="space-y-2">
              {data.monthly_growth.map((m: any) => {
                const max = Math.max(...data.monthly_growth.map((x: any) => x.orders))
                return (
                  <div key={m.month}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{m.month}</span>
                      <span className="font-bold">{m.orders} طلب</span>
                    </div>
                    <div className="h-2 bg-ink-900/10 rounded overflow-hidden">
                      <div className="h-full bg-gold-500" style={{ width: `${(m.orders / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
