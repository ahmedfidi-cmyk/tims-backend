'use client'

import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import Link from 'next/link'
import { mockOrders, mockEarnings, mockInventory } from '@/lib/mock/vendor-data'

function formatSar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', {
    style: 'currency',
    currency: 'SAR',
  })
}

export default function VendorDashboard() {
  const { vendor, logout } = useVendorAuth()

  const totalListings = mockInventory.length
  const totalStock = mockInventory.reduce((sum, item) => sum + item.stock, 0)
  const activeOrders = mockOrders.filter((o) => o.status === 'pending' || o.status === 'shipped').length

  return (
    <div className="min-h-screen bg-paper-50">
      {/* Header */}
      <header className="bg-ink-900 text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">{vendor?.businessName}</h1>
            <p className="text-ink-900/70 text-sm">{vendor?.email}</p>
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
      <nav className="bg-white border-b border-ink-900/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex gap-4 overflow-x-auto">
            <Link href="/vendor/dashboard" className="text-coral-500 font-bold border-b-2 border-coral-500 whitespace-nowrap">
              لوحة التحكم
            </Link>
            <Link href="/vendor/inventory/manage" className="text-ink-900/60 hover:text-ink-900 whitespace-nowrap">
              المخزون
            </Link>
            <Link href="/vendor/devices/list" className="text-ink-900/60 hover:text-ink-900 whitespace-nowrap">
              الإعلانات
            </Link>
            <Link href="/vendor/orders/history" className="text-ink-900/60 hover:text-ink-900 whitespace-nowrap">
              الطلبات
            </Link>
            <Link href="/vendor/earnings/dashboard" className="text-ink-900/60 hover:text-ink-900 whitespace-nowrap">
              الأرباح
            </Link>
            <Link href="/vendor/profile/settings" className="text-ink-900/60 hover:text-ink-900 whitespace-nowrap">
              الملف الشخصي
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Earnings Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card border-l-4 border-coral-500">
            <p className="text-ink-900/60 text-sm mb-2">الأرباح الكلية</p>
            <p className="price">{formatSar(mockEarnings.total_commission)}</p>
            <p className="text-xs text-ink-900/50 mt-2">منذ البداية</p>
          </div>
          <div className="card border-l-4 border-gold-500">
            <p className="text-ink-900/60 text-sm mb-2">قيد التسوية</p>
            <p className="price text-gold-500">{formatSar(mockEarnings.pending)}</p>
            <p className="text-xs text-ink-900/50 mt-2">في الانتظار</p>
          </div>
          <div className="card border-l-4 border-ink-900">
            <p className="text-ink-900/60 text-sm mb-2">المسدد</p>
            <p className="price text-ink-900">{formatSar(mockEarnings.settled)}</p>
            <p className="text-xs text-ink-900/50 mt-2">تم تحويله للحساب</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">المنتجات المدرجة</p>
            <p className="text-3xl font-bold text-ink-900">{totalListings}</p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">المخزون الكلي</p>
            <p className="text-3xl font-bold text-ink-900">{totalStock}</p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">الطلبات النشطة</p>
            <p className="text-3xl font-bold text-ink-900">{activeOrders}</p>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-ink-900 mb-4">الطلبات الأخيرة</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-900/10">
                  <th className="text-right pb-3">رقم الطلب</th>
                  <th className="text-right pb-3">العميل</th>
                  <th className="text-right pb-3">المبلغ</th>
                  <th className="text-right pb-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {mockOrders.slice(0, 5).map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-ink-900/5 hover:bg-ink-900/2 transition"
                  >
                    <td className="py-3">{order.id}</td>
                    <td className="py-3">{order.customer_name}</td>
                    <td className="py-3 price">{formatSar(order.amount)}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          order.status === 'delivered'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'shipped'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {order.status === 'delivered'
                          ? 'تم التسليم'
                          : order.status === 'shipped'
                            ? 'قيد الشحن'
                            : 'قيد المعالجة'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Links */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            href="/vendor/inventory/upload"
            className="card text-center hover:bg-ink-900/5 transition"
          >
            <p className="text-lg font-bold text-coral-500">📦</p>
            <p className="font-medium text-ink-900">رفع المخزون</p>
            <p className="text-xs text-ink-900/60 mt-1">أضف منتجات جديدة</p>
          </Link>
          <Link
            href="/vendor/orders/history"
            className="card text-center hover:bg-ink-900/5 transition"
          >
            <p className="text-lg font-bold text-gold-500">📋</p>
            <p className="font-medium text-ink-900">الطلبات</p>
            <p className="text-xs text-ink-900/60 mt-1">عرض جميع الطلبات</p>
          </Link>
          <Link
            href="/vendor/earnings/dashboard"
            className="card text-center hover:bg-ink-900/5 transition"
          >
            <p className="text-lg font-bold text-gold-500">💰</p>
            <p className="font-medium text-ink-900">الأرباح</p>
            <p className="text-xs text-ink-900/60 mt-1">عرض الأرباح والتسويات</p>
          </Link>
          <Link
            href="/vendor/profile/settings"
            className="card text-center hover:bg-ink-900/5 transition"
          >
            <p className="text-lg font-bold text-ink-900">⚙️</p>
            <p className="font-medium text-ink-900">الإعدادات</p>
            <p className="text-xs text-ink-900/60 mt-1">إدارة الحساب</p>
          </Link>
        </div>
      </main>
    </div>
  )
}
