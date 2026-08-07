'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'

interface Order {
  orderId: string
  status: string
  fulfillmentType: string
  deviceId: string
  subtotalHalalat: number
  commissionHalalat: number
  vendorNetHalalat: number
  totalHalalat: number
  shippingRef?: string | null
  createdAt: string
}

function formatSar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })
}

const STATUS: Record<string, string> = {
  PENDING_PAYMENT: 'بانتظار الدفع', AWAITING_FULFILLMENT: 'قيد التجهيز', SHIPPED: 'تم الشحن',
  COMPLETED: 'مكتمل', IN_CUSTODY: 'محفوظ رقمياً', PAYMENT_FAILED: 'فشل الدفع', CANCELLED: 'ملغى', REFUNDED: 'مسترجع',
}

const STEP: Record<string, number> = {
  AWAITING_FULFILLMENT: 1, SHIPPED: 2, COMPLETED: 3, IN_CUSTODY: 3,
}

export default function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const { logout } = useVendorAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [shippingRef, setShippingRef] = useState('')
  const [shipping, setShipping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    return fetch(`/api/vendor/orders/${orderId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setOrder)
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  async function ship() {
    if (!shippingRef.trim()) return setError('أدخل رقم الشحنة')
    setError(null)
    setShipping(true)
    try {
      const r = await fetch(`/api/vendor/orders/${orderId}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ shippingRef: shippingRef.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error ?? 'تعذّر شحن الطلب'); return }
      await load()
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setShipping(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-paper-50 text-ink-900/60">جاري التحميل...</div>
  }
  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-50">
        <div className="card text-center">
          <p className="text-ink-900 mb-4">الطلب غير موجود أو لا تملك صلاحية عرضه</p>
          <Link href="/vendor/orders/history" className="btn-primary inline-block">العودة للطلبات</Link>
        </div>
      </div>
    )
  }

  const step = STEP[order.status] ?? 0
  const timeline = [
    { n: 1, label: 'بانتظار الشحن' },
    { n: 2, label: 'تم الشحن' },
    { n: 3, label: 'تم التسليم' },
  ]

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <header className="bg-lahtha-ink text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">تفاصيل الطلب</h1>
            <p className="text-ink-900/70 text-sm font-mono">{order.orderId}</p>
          </div>
          <button onClick={logout} className="px-4 py-2 bg-coral-500 rounded-lg hover:opacity-90">تسجيل الخروج</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Status */}
        <div className="card mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-ink-900">حالة الطلب</h2>
            <span className="px-3 py-1 rounded bg-ink-900/5 text-sm font-medium">{STATUS[order.status] ?? order.status}</span>
          </div>
          {order.fulfillmentType === 'physical_fulfillment' ? (
            <div className="flex justify-between items-center">
              {timeline.map((item, idx) => (
                <div key={item.n} className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white mb-2 ${step >= item.n ? 'bg-coral-500' : 'bg-ink-900/30'}`}>
                    {step >= item.n ? '✓' : item.n}
                  </div>
                  <p className="font-medium text-ink-900 text-sm">{item.label}</p>
                  {idx < timeline.length - 1 && <div className={`h-1 w-full mt-4 ${step > item.n ? 'bg-coral-500' : 'bg-ink-900/10'}`} />}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ink-900/60 text-sm">طلب رقمي — يُحفظ الجهاز في عهدة لحظة بعد الدفع، دون شحن.</p>
          )}
        </div>

        {/* Ship action */}
        {order.status === 'AWAITING_FULFILLMENT' && order.fulfillmentType === 'physical_fulfillment' && (
          <div className="card mb-8 space-y-3">
            <h3 className="text-lg font-bold text-ink-900">شحن الطلب</h3>
            <p className="text-xs text-ink-900/60">أدخل رقم تتبّع الشحنة لتحديث حالة الطلب إلى «تم الشحن».</p>
            <div className="flex gap-2">
              <input
                value={shippingRef}
                onChange={(e) => setShippingRef(e.target.value)}
                placeholder="رقم الشحنة / التتبّع"
                className="flex-1 px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
              />
              <button onClick={ship} disabled={shipping} className="btn-primary px-6 disabled:opacity-50">
                {shipping ? 'جارٍ الشحن...' : 'تأكيد الشحن'}
              </button>
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        )}
        {order.status === 'SHIPPED' && (
          <div className="card mb-8">
            <p className="text-sm text-ink-900">
              تم شحن الطلب{order.shippingRef ? ` — رقم الشحنة: ` : ''}
              {order.shippingRef && <span className="font-mono">{order.shippingRef}</span>}. بانتظار تأكيد العميل للاستلام.
            </p>
          </div>
        )}

        {/* Financials + device */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-bold text-ink-900 mb-4">الملخص المالي</h3>
            <div className="space-y-3">
              <div className="flex justify-between"><p className="text-ink-900/60">سعر البيع</p><p className="font-bold text-ink-900">{formatSar(order.totalHalalat)}</p></div>
              <div className="flex justify-between border-t border-ink-900/10 pt-3"><p className="text-ink-900/60">عمولة لحظة (5%)</p><p className="font-bold text-coral-500">-{formatSar(order.commissionHalalat)}</p></div>
              <div className="flex justify-between border-t border-ink-900/10 pt-3"><p className="text-sm font-medium text-ink-900">المبلغ الصافي لك</p><p className="text-xl font-bold text-gold-500">{formatSar(order.vendorNetHalalat)}</p></div>
            </div>
          </div>
          <div className="card">
            <h3 className="text-lg font-bold text-ink-900 mb-4">المنتج</h3>
            <div className="space-y-3">
              <div><p className="text-sm text-ink-900/60">معرّف الجهاز</p><p className="font-mono text-xs text-ink-900">{order.deviceId}</p></div>
              <div><p className="text-sm text-ink-900/60">نوع التسليم</p><p className="text-ink-900">{order.fulfillmentType === 'physical_fulfillment' ? 'شحن فعلي' : 'حفظ رقمي'}</p></div>
              <div><p className="text-sm text-ink-900/60">التاريخ</p><p className="text-ink-900">{new Date(order.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Link href="/vendor/orders/history" className="btn-secondary inline-block">العودة للطلبات</Link>
        </div>
      </main>
    </div>
  )
}
