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

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) { router.push('/store/auth?next=/store/orders'); return }
    fetch('/api/store/orders', { credentials: 'include' }).then((r) => r.json()).then((d) => setOrders(d.items || [])).finally(() => setLoading(false))
  }, [isAuthenticated, isLoading, router])

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink-900 mb-6">طلباتي</h1>
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
            <div key={o.orderId} className="flex justify-between items-center py-3 text-sm">
              <div>
                <p className="font-mono text-xs text-ink-900/50">{o.orderId.slice(0, 8)}</p>
                <p className="text-ink-900/70">{new Date(o.createdAt).toLocaleDateString('ar-SA')}</p>
              </div>
              <span className="px-2 py-1 rounded bg-ink-900/5 text-xs">{STATUS[o.status] ?? o.status}</span>
              <span className="price">{sar(o.totalHalalat)}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
