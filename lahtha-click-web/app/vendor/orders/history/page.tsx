'use client'

import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import Link from 'next/link'
import { mockOrders } from '@/lib/mock/vendor-data'

function formatSar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', {
    style: 'currency',
    currency: 'SAR',
  })
}

const statusLabels: Record<string, { text: string; bg: string }> = {
  pending: { text: 'قيد المعالجة', bg: 'bg-yellow-100 text-yellow-800' },
  shipped: { text: 'قيد الشحن', bg: 'bg-blue-100 text-blue-800' },
  delivered: { text: 'تم التسليم', bg: 'bg-green-100 text-green-800' },
}

export default function OrdersHistoryPage() {
  const { vendor, logout } = useVendorAuth()
  const [sortBy, setSortBy] = React.useState<'recent' | 'oldest'>('recent')
  const sorted = [...mockOrders].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      {/* Header */}
      <header className="bg-ink-900 text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">سجل الطلبات</h1>
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
            <Link href="/vendor/orders/history" className="text-gold-500 font-bold border-b-2 border-gold-500">
              الطلبات
            </Link>
            <Link href="/vendor/earnings/dashboard" className="text-white/60 hover:text-white">
              الأرباح
            </Link>
            <Link href="/vendor/profile/settings" className="text-white/60 hover:text-white">
              الملف الشخصي
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Filter & Sort */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-ink-900">
            إجمالي الطلبات: {mockOrders.length}
          </h2>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'oldest')}
            className="px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
          >
            <option value="recent">الأحدث أولاً</option>
            <option value="oldest">الأقدم أولاً</option>
          </select>
        </div>

        {/* Orders Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-900/5 border-b border-ink-900/10">
                <tr>
                  <th className="text-right p-4 font-semibold text-ink-900">رقم الطلب</th>
                  <th className="text-right p-4 font-semibold text-ink-900">اسم العميل</th>
                  <th className="text-right p-4 font-semibold text-ink-900">التاريخ</th>
                  <th className="text-right p-4 font-semibold text-ink-900">المبلغ</th>
                  <th className="text-right p-4 font-semibold text-ink-900">العمولة (5%)</th>
                  <th className="text-right p-4 font-semibold text-ink-900">الحالة</th>
                  <th className="text-right p-4 font-semibold text-ink-900"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-ink-900/5 hover:bg-ink-900/2 transition"
                  >
                    <td className="p-4 font-mono text-xs">{order.id}</td>
                    <td className="p-4">{order.customer_name}</td>
                    <td className="p-4 text-xs text-ink-900/60">
                      {new Date(order.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="p-4 font-bold text-coral-500">
                      {formatSar(order.amount)}
                    </td>
                    <td className="p-4 font-bold text-gold-500">
                      {formatSar(order.commission)}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusLabels[order.status].bg}`}>
                        {statusLabels[order.status].text}
                      </span>
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/vendor/orders/${order.id}`}
                        className="text-coral-500 hover:underline text-sm"
                      >
                        تفاصيل
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">إجمالي المبيعات</p>
            <p className="text-2xl font-bold text-ink-900">
              {formatSar(mockOrders.reduce((sum, o) => sum + o.amount, 0))}
            </p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">إجمالي العمولات</p>
            <p className="text-2xl font-bold text-coral-500">
              {formatSar(mockOrders.reduce((sum, o) => sum + o.commission, 0))}
            </p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">الطلبات المسلمة</p>
            <p className="text-2xl font-bold text-ink-900">
              {mockOrders.filter(o => o.status === 'delivered').length}
            </p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">الطلبات المعلقة</p>
            <p className="text-2xl font-bold text-ink-900">
              {mockOrders.filter(o => o.status === 'pending' || o.status === 'shipped').length}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

import React from 'react'
