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

const statusSteps = {
  pending: 1,
  shipped: 2,
  delivered: 3,
}

export default function OrderDetailPage({
  params,
}: {
  params: { orderId: string }
}) {
  const { vendor, logout } = useVendorAuth()
  const order = mockOrders.find(o => o.id === params.orderId)

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-50">
        <div className="card text-center">
          <p className="text-ink-900 mb-4">الطلب غير موجود</p>
          <Link href="/vendor/orders/history" className="btn-primary inline-block">
            العودة للطلبات
          </Link>
        </div>
      </div>
    )
  }

  const timeline = [
    { step: 1, label: 'تم الطلب', date: order.created_at, done: true },
    { step: 2, label: 'قيد الشحن', date: order.created_at, done: statusSteps[order.status as keyof typeof statusSteps] >= 2 },
    { step: 3, label: 'تم التسليم', date: order.created_at, done: statusSteps[order.status as keyof typeof statusSteps] >= 3 },
  ]

  return (
    <div className="min-h-screen bg-paper-50">
      {/* Header */}
      <header className="bg-ink-900 text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">تفاصيل الطلب</h1>
            <p className="text-ink-900/70 text-sm">{order.id}</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-coral-500 rounded-lg hover:opacity-90"
          >
            تسجيل الخروج
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Status Timeline */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-ink-900 mb-6">حالة الطلب</h2>
          <div className="flex justify-between items-center">
            {timeline.map((item, idx) => (
              <div key={item.step} className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white mb-2 ${
                    item.done ? 'bg-coral-500' : 'bg-ink-900/30'
                  }`}
                >
                  {item.done ? '✓' : item.step}
                </div>
                <p className="font-medium text-ink-900">{item.label}</p>
                <p className="text-xs text-ink-900/60 mt-1">
                  {new Date(item.date).toLocaleDateString('ar-SA')}
                </p>
                {idx < timeline.length - 1 && (
                  <div
                    className={`h-1 w-full mt-4 ${item.done ? 'bg-coral-500' : 'bg-ink-900/10'}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Order Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Customer Info */}
          <div className="card">
            <h3 className="text-lg font-bold text-ink-900 mb-4">بيانات العميل</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-ink-900/60">الاسم</p>
                <p className="font-medium text-ink-900">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-ink-900/60">رقم الطلب</p>
                <p className="font-mono text-xs text-ink-900">{order.id}</p>
              </div>
              <div>
                <p className="text-sm text-ink-900/60">التاريخ</p>
                <p className="text-ink-900">
                  {new Date(order.created_at).toLocaleDateString('ar-SA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="card">
            <h3 className="text-lg font-bold text-ink-900 mb-4">الملخص المالي</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <p className="text-ink-900/60">سعر البيع</p>
                <p className="font-bold text-ink-900">{formatSar(order.amount)}</p>
              </div>
              <div className="flex justify-between border-t border-ink-900/10 pt-3">
                <p className="text-ink-900/60">عمولة LAHTHA (5%)</p>
                <p className="font-bold text-coral-500">-{formatSar(order.commission)}</p>
              </div>
              <div className="flex justify-between border-t border-ink-900/10 pt-3">
                <p className="text-sm font-medium text-ink-900">المبلغ الصافي لك</p>
                <p className="text-xl font-bold text-gold-500">
                  {formatSar(order.amount - order.commission)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Device Info */}
        <div className="card mb-8">
          <h3 className="text-lg font-bold text-ink-900 mb-4">المنتج</h3>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-ink-900/60 mb-1">رقم IMEI</p>
              <p className="font-mono text-ink-900">{order.device_imei}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-ink-900/60 mb-1">الكمية</p>
              <p className="text-2xl font-bold text-ink-900">1</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-ink-900/60 mb-1">السعر</p>
              <p className="price">{formatSar(order.amount)}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link href="/vendor/orders/history" className="btn-secondary flex-1 text-center">
            العودة للطلبات
          </Link>
          <button className="btn-primary flex-1">
            طباعة الإيصال
          </button>
        </div>
      </main>
    </div>
  )
}
