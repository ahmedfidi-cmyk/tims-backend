'use client'

import { useEffect, useState } from 'react'
import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import Link from 'next/link'
import ProductTour, { type TourStep } from '@/components/ProductTour'

const VENDOR_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="vendor-earnings"]', title: 'أرباحك', body: 'الأرباح الكلية، ما زال قيد التسوية، وما تم تحرير دفعه — محدَّثة من طلباتك الفعلية.' },
  { selector: '[data-tour="vendor-stats"]', title: 'نظرة سريعة', body: 'عدد أجهزتك المسجّلة، النشطة منها، وطلباتك الجارية الآن.' },
  { selector: '[data-tour="vendor-orders"]', title: 'أحدث الطلبات', body: 'آخر خمسة طلبات على متجرك، مع حالتها الحيّة.' },
  { selector: '[data-tour="vendor-actions"]', title: 'إجراءات سريعة', body: 'أضف جهازاً جديداً، تابع الطلبات، أو راجع أرباحك من هنا.' },
]

interface Order {
  orderId: string
  status: string
  fulfillmentType: string
  totalHalalat: number
  commissionHalalat: number
  vendorNetHalalat: number
  createdAt: string
}
interface Device {
  id: string
  status: 'active' | 'paused' | 'sold' | 'draft'
}

function formatSar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', {
    style: 'currency',
    currency: 'SAR',
  })
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
const OPEN_STATUSES = new Set(['AWAITING_FULFILLMENT', 'SHIPPED'])
const SETTLED_STATUSES = new Set(['COMPLETED', 'IN_CUSTODY'])

export default function VendorDashboard() {
  const { vendor, logout } = useVendorAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/vendor/orders', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/vendor/devices', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([ordersRes, devicesRes]) => {
        setOrders(ordersRes.items || [])
        setDevices(devicesRes.items || [])
        setPending(Boolean(ordersRes.pending || devicesRes.pending))
      })
      .finally(() => setLoading(false))
  }, [])

  const settled = orders.filter((o) => SETTLED_STATUSES.has(o.status))
  const openOrders = orders.filter((o) => OPEN_STATUSES.has(o.status))
  const settledNet = settled.reduce((s, o) => s + o.vendorNetHalalat, 0)
  const pendingNet = openOrders.reduce((s, o) => s + o.vendorNetHalalat, 0)
  const activeDevices = devices.filter((d) => d.status === 'active').length
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <ProductTour tourId="vendor-dashboard" steps={VENDOR_TOUR_STEPS} autoStart={!loading && !pending} />

      {/* Header */}
      <header className="bg-lahtha-ink text-white p-6">
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
      <nav className="bg-ink-900/80 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex gap-4 overflow-x-auto">
            <Link href="/vendor/dashboard" className="text-gold-500 font-bold border-b-2 border-gold-500 whitespace-nowrap">
              لوحة التحكم
            </Link>
            <Link href="/vendor/inventory/manage" className="text-white/60 hover:text-white whitespace-nowrap">
              المخزون
            </Link>
            <Link href="/vendor/devices/list" className="text-white/60 hover:text-white whitespace-nowrap">
              الإعلانات
            </Link>
            <Link href="/vendor/orders/history" className="text-white/60 hover:text-white whitespace-nowrap">
              الطلبات
            </Link>
            <Link href="/vendor/earnings/dashboard" className="text-white/60 hover:text-white whitespace-nowrap">
              الأرباح
            </Link>
            <Link href="/vendor/profile/settings" className="text-white/60 hover:text-white whitespace-nowrap">
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
            <p className="text-ink-900/60 text-sm">ستظهر بياناتك هنا فور اعتماد متجرك من فريق لحظة.</p>
          </div>
        ) : (
          <>
            {/* Earnings Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" data-tour="vendor-earnings">
              <div className="card border-l-4 border-coral-500">
                <p className="text-ink-900/60 text-sm mb-2">الأرباح الكلية</p>
                <p className="price">{formatSar(settledNet + pendingNet)}</p>
                <p className="text-xs text-ink-900/50 mt-2">منذ البداية</p>
              </div>
              <div className="card border-l-4 border-gold-500">
                <p className="text-ink-900/60 text-sm mb-2">قيد التسوية</p>
                <p className="price text-gold-500">{formatSar(pendingNet)}</p>
                <p className="text-xs text-ink-900/50 mt-2">{openOrders.length} طلب قيد التنفيذ</p>
              </div>
              <div className="card border-l-4 border-ink-900">
                <p className="text-ink-900/60 text-sm mb-2">المسدد</p>
                <p className="price text-ink-900">{formatSar(settledNet)}</p>
                <p className="text-xs text-ink-900/50 mt-2">{settled.length} طلب مكتمل</p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" data-tour="vendor-stats">
              <div className="card">
                <p className="text-ink-900/60 text-sm mb-2">المنتجات المدرجة</p>
                <p className="text-3xl font-bold text-ink-900">{devices.length}</p>
              </div>
              <div className="card">
                <p className="text-ink-900/60 text-sm mb-2">الأجهزة النشطة</p>
                <p className="text-3xl font-bold text-ink-900">{activeDevices}</p>
              </div>
              <div className="card">
                <p className="text-ink-900/60 text-sm mb-2">الطلبات النشطة</p>
                <p className="text-3xl font-bold text-ink-900">{openOrders.length}</p>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="card mb-8" data-tour="vendor-orders">
              <h2 className="text-xl font-bold text-ink-900 mb-4">الطلبات الأخيرة</h2>
              {recentOrders.length === 0 ? (
                <p className="text-ink-900/60 text-sm py-6 text-center">لا توجد طلبات بعد.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-900/10">
                        <th className="text-right pb-3">رقم الطلب</th>
                        <th className="text-right pb-3">التاريخ</th>
                        <th className="text-right pb-3">المبلغ</th>
                        <th className="text-right pb-3">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr
                          key={order.orderId}
                          className="border-b border-ink-900/5 hover:bg-ink-900/2 transition"
                        >
                          <td className="py-3 font-mono text-xs">{order.orderId.slice(0, 8)}</td>
                          <td className="py-3 text-xs text-ink-900/60">
                            {new Date(order.createdAt).toLocaleDateString('ar-SA')}
                          </td>
                          <td className="py-3 price">{formatSar(order.totalHalalat)}</td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS[order.status]?.bg ?? 'bg-ink-900/10'}`}>
                              {STATUS[order.status]?.text ?? order.status}
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

        {/* Action Links */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-tour="vendor-actions">
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
