'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminNav } from '@/components/AdminNav'

function formatSar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', {
    style: 'currency',
    currency: 'SAR',
  })
}

export default function AdminDashboardPage() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [pendingKyc, setPendingKyc] = useState(0)

  useEffect(() => {
    fetch('/api/admin/analytics').then(r => r.json()).then(setAnalytics)
    fetch('/api/admin/kyc').then(r => r.json()).then(d => {
      setPendingKyc((d.items || []).filter((k: any) => k.status === 'pending').length)
    })
  }, [])

  if (!analytics) {
    return (
      <>
        <AdminNav />
        <p className="text-center py-12 text-ink-900/60">جاري التحميل...</p>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card border-l-4 border-coral-500">
            <p className="text-ink-900/60 text-sm mb-2">إجمالي المبيعات (GMV)</p>
            <p className="text-3xl font-bold text-coral-500">{formatSar(analytics.total_gmv)}</p>
          </div>
          <div className="card border-l-4 border-gold-500">
            <p className="text-ink-900/60 text-sm mb-2">إجمالي العمولات (5%)</p>
            <p className="text-3xl font-bold text-gold-500">{formatSar(analytics.total_commission)}</p>
          </div>
          <div className="card border-l-4 border-green-500">
            <p className="text-ink-900/60 text-sm mb-2">البائعون النشطون</p>
            <p className="text-3xl font-bold text-green-600">{analytics.active_vendors}</p>
          </div>
          <div className="card border-l-4 border-ink-900">
            <p className="text-ink-900/60 text-sm mb-2">إجمالي الطلبات</p>
            <p className="text-3xl font-bold text-ink-900">{analytics.total_orders}</p>
          </div>
        </div>

        {/* Alerts */}
        {pendingKyc > 0 && (
          <Link href="/admin/kyc-approvals" className="block card mb-6 bg-yellow-50 border-yellow-200 hover:bg-yellow-100 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-yellow-900">⏳ {pendingKyc} طلب تحقق ينتظر المراجعة</p>
                <p className="text-sm text-yellow-700">انقر للذهاب إلى صفحة المراجعة</p>
              </div>
              <span className="text-2xl">→</span>
            </div>
          </Link>
        )}

        {/* Growth Chart */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-ink-900 mb-6">النمو الشهري</h2>
          <div className="space-y-4">
            {analytics.monthly_growth.map((m: any) => {
              const max = Math.max(...analytics.monthly_growth.map((x: any) => x.gmv))
              return (
                <div key={m.month} className="flex items-center justify-between">
                  <p className="font-medium text-ink-900 w-24">{m.month}</p>
                  <div className="flex-1 ml-4 h-8 bg-ink-900/10 rounded-lg relative overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-coral-500 to-gold-500 rounded-lg"
                      style={{ width: `${(m.gmv / max) * 100}%` }}
                    />
                  </div>
                  <p className="font-bold text-right w-40 text-ink-900">{formatSar(m.gmv)}</p>
                  <p className="text-sm text-ink-900/60 w-20 text-left">{m.orders} طلب</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/vendors" className="card text-center hover:bg-ink-900/5 transition">
            <p className="text-3xl mb-2">🏪</p>
            <p className="font-bold text-ink-900">إدارة البائعين</p>
          </Link>
          <Link href="/admin/kyc-approvals" className="card text-center hover:bg-ink-900/5 transition">
            <p className="text-3xl mb-2">✅</p>
            <p className="font-bold text-ink-900">مراجعة التحقق</p>
          </Link>
          <Link href="/admin/analytics" className="card text-center hover:bg-ink-900/5 transition">
            <p className="text-3xl mb-2">📊</p>
            <p className="font-bold text-ink-900">التحليلات الكاملة</p>
          </Link>
        </div>
      </main>
    </div>
  )
}
