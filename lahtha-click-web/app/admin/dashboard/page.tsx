'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminNav } from '@/components/AdminNav'
import ProductTour, { type TourStep } from '@/components/ProductTour'

const ADMIN_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="admin-kpis"]', title: 'مؤشرات المنصّة', body: 'إجمالي المبيعات والعمولات والبائعين النشطين والطلبات — من بيانات الطلبات الفعلية.' },
  { selector: '[data-tour="admin-growth"]', title: 'النمو الشهري', body: 'اتجاه المبيعات المكتملة شهرياً، لرصد نمو المنصة بمرور الوقت.' },
  { selector: '[data-tour="admin-actions"]', title: 'الوصول السريع', body: 'إدارة البائعين، مراجعة طلبات التحقق، أو فتح التحليلات الكاملة.' },
]

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
  return (halalat / 100).toLocaleString('ar-SA', {
    style: 'currency',
    currency: 'SAR',
  })
}

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]
function monthLabel(ym: string) {
  const [year, month] = ym.split('-').map(Number)
  return `${AR_MONTHS[(month ?? 1) - 1] ?? ym} ${year}`
}

export default function AdminDashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingKyc, setPendingKyc] = useState(0)

  useEffect(() => {
    fetch('/api/admin/analytics', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setAnalytics(d)))
    fetch('/api/admin/kyc', { credentials: 'include' }).then(r => r.json()).then(d => {
      setPendingKyc((d.items || []).filter((k: any) => k.status === 'pending').length)
    })
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-lahtha-pattern-dark">
        <AdminNav />
        <p className="text-center py-16 text-ink-900/60">{error}</p>
      </div>
    )
  }

  if (!analytics) {
    return (
      <>
        <AdminNav />
        <p className="text-center py-12 text-ink-900/60">جاري التحميل...</p>
      </>
    )
  }

  const maxGmv = Math.max(1, ...analytics.monthlyGrowth.map((m) => m.gmv))

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <ProductTour tourId="admin-dashboard" steps={ADMIN_TOUR_STEPS} />
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8" data-tour="admin-kpis">
          <div className="card border-l-4 border-coral-500">
            <p className="text-ink-900/60 text-sm mb-2">إجمالي المبيعات (GMV)</p>
            <p className="text-3xl font-bold text-coral-500">{formatSar(analytics.totalGmvHalalat)}</p>
          </div>
          <div className="card border-l-4 border-gold-500">
            <p className="text-ink-900/60 text-sm mb-2">إجمالي العمولات (5%)</p>
            <p className="text-3xl font-bold text-gold-500">{formatSar(analytics.totalCommissionHalalat)}</p>
          </div>
          <div className="card border-l-4 border-green-500">
            <p className="text-ink-900/60 text-sm mb-2">البائعون النشطون</p>
            <p className="text-3xl font-bold text-green-600">{analytics.activeVendors}</p>
          </div>
          <div className="card border-l-4 border-ink-900">
            <p className="text-ink-900/60 text-sm mb-2">إجمالي الطلبات</p>
            <p className="text-3xl font-bold text-ink-900">{analytics.totalOrders}</p>
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
        <div className="card mb-8" data-tour="admin-growth">
          <h2 className="text-xl font-bold text-ink-900 mb-6">النمو الشهري</h2>
          {analytics.monthlyGrowth.length === 0 ? (
            <p className="text-ink-900/60 text-sm py-6 text-center">لا توجد مبيعات مكتملة بعد.</p>
          ) : (
            <div className="space-y-4">
              {analytics.monthlyGrowth.map((m) => (
                <div key={m.month} className="flex items-center justify-between">
                  <p className="font-medium text-ink-900 w-28">{monthLabel(m.month)}</p>
                  <div className="flex-1 ml-4 h-8 bg-ink-900/10 rounded-lg relative overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-coral-500 to-gold-500 rounded-lg"
                      style={{ width: `${(m.gmv / maxGmv) * 100}%` }}
                    />
                  </div>
                  <p className="font-bold text-right w-40 text-ink-900">{formatSar(m.gmv)}</p>
                  <p className="text-sm text-ink-900/60 w-20 text-left">{m.orders} طلب</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-tour="admin-actions">
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
