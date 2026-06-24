'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context'

interface Order {
  orderId: string
  status: string
  totalHalalat: number
  fulfillmentType: string
  createdAt: string
}

function sar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })
}
const STATUS: Record<string, string> = {
  PENDING_PAYMENT: 'بانتظار الدفع', AWAITING_FULFILLMENT: 'قيد التجهيز', SHIPPED: 'تم الشحن',
  COMPLETED: 'مكتمل', IN_CUSTODY: 'محفوظ رقمياً', PAYMENT_FAILED: 'فشل الدفع', CANCELLED: 'ملغى', REFUNDED: 'مسترجع',
}

export default function OrdersPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useCustomerAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function loadOrders() {
    return fetch('/api/store/orders', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setOrders(d.items || []))
  }

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) { router.push('/store/auth?next=/store/orders'); return }
    loadOrders().finally(() => setLoading(false))
  }, [isAuthenticated, isLoading, router])

  async function pay(orderId: string) {
    setError(null)
    setBusyId(orderId)
    try {
      const r = await fetch(`/api/store/orders/${orderId}/pay`, { method: 'POST', credentials: 'include' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error ?? 'تعذّر إتمام الدفع'); return }
      // Real providers return a hosted-checkout URL; the dev stub auto-captures.
      if (d.redirectUrl) { window.location.href = d.redirectUrl; return }
      await loadOrders()
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmReceipt(orderId: string) {
    setError(null)
    setBusyId(orderId)
    try {
      const r = await fetch(`/api/store/orders/${orderId}/confirm-receipt`, { method: 'POST', credentials: 'include' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error ?? 'تعذّر تأكيد الاستلام'); return }
      await loadOrders()
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink-900 mb-6">طلباتي</h1>
      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {loading ? (
        <p className="text-center py-12 text-ink-900/60">جاري التحميل...</p>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-ink-900/60 mb-4">لا توجد طلبات بعد</p>
          <Link href="/store" className="btn-primary inline-block">تصفّح المتجر</Link>
        </div>
      ) : (
        <div className="card divide-y divide-ink-900/10">
          {orders.map((o) => (
            <div key={o.orderId} className="flex justify-between items-center gap-3 py-3 text-sm">
              <div>
                <p className="font-mono text-xs text-ink-900/50">{o.orderId.slice(0, 8)}</p>
                <p className="text-ink-900/70">{new Date(o.createdAt).toLocaleDateString('ar-SA')}</p>
              </div>
              <span className="px-2 py-1 rounded bg-ink-900/5 text-xs">{STATUS[o.status] ?? o.status}</span>
              <span className="price">{sar(o.totalHalalat)}</span>
              {o.status === 'PENDING_PAYMENT' && (
                <button
                  type="button"
                  onClick={() => pay(o.orderId)}
                  disabled={busyId === o.orderId}
                  className="btn-primary text-xs px-3 py-1 disabled:opacity-60"
                >
                  {busyId === o.orderId ? 'جارٍ الدفع...' : 'ادفع الآن'}
                </button>
              )}
              {o.status === 'SHIPPED' && (
                <button
                  type="button"
                  onClick={() => confirmReceipt(o.orderId)}
                  disabled={busyId === o.orderId}
                  className="btn-primary text-xs px-3 py-1 disabled:opacity-60"
                >
                  {busyId === o.orderId ? 'جارٍ التأكيد...' : 'تأكيد الاستلام'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
