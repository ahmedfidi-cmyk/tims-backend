'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart/cart-context'
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context'

function sar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })
}

export default function CartPage() {
  const router = useRouter()
  const { items, remove, totalHalalat, clear } = useCart()
  const { isAuthenticated, isLoading } = useCustomerAuth()
  const [fulfillment, setFulfillment] = useState<'physical_fulfillment' | 'digital_custody'>('physical_fulfillment')
  const [placing, setPlacing] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const checkout = async () => {
    if (!isAuthenticated) {
      router.push('/store/auth?next=/store/cart')
      return
    }
    setPlacing(true)
    setErrors([])
    const failed: string[] = []
    for (const item of items) {
      const res = await fetch('/api/store/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId: item.listingId, fulfillmentType: fulfillment }),
      })
      if (res.ok) {
        remove(item.listingId)
      } else {
        const data = await res.json().catch(() => ({}))
        failed.push(`${item.modelName}: ${data.error ?? 'فشل'}`)
      }
    }
    setPlacing(false)
    if (failed.length === 0) {
      clear()
      router.push('/store/orders')
    } else {
      setErrors(failed)
    }
  }

  if (isLoading) return <main className="max-w-3xl mx-auto px-4 py-12 text-center text-ink-900/60">جاري التحميل...</main>

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink-900 mb-6">سلة المشتريات</h1>
      {items.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-ink-900/60 mb-4">السلة فارغة</p>
          <Link href="/store" className="btn-primary inline-block">تصفّح المتجر</Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card divide-y divide-ink-900/10">
            {items.map((item) => (
              <div key={item.listingId} className="flex justify-between items-center py-3">
                <div>
                  <p className="font-medium text-ink-900">{item.modelName}</p>
                  <p className="price">{sar(item.priceHalalat)}</p>
                </div>
                <button onClick={() => remove(item.listingId)} className="text-red-600 hover:bg-red-50 px-3 py-1 rounded text-sm">إزالة</button>
              </div>
            ))}
          </div>

          <div className="card">
            <p className="text-sm font-medium text-ink-900 mb-2">طريقة الاستلام</p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={fulfillment === 'physical_fulfillment'} onChange={() => setFulfillment('physical_fulfillment')} /> شحن للعنوان</label>
              <label className="flex items-center gap-2"><input type="radio" checked={fulfillment === 'digital_custody'} onChange={() => setFulfillment('digital_custody')} /> حفظ رقمي (ممتلكاتي)</label>
            </div>
          </div>

          <div className="card flex justify-between items-center">
            <span className="font-bold text-ink-900">الإجمالي</span>
            <span className="price text-xl">{sar(totalHalalat)}</span>
          </div>

          {errors.length > 0 && (
            <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm space-y-1">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          <button onClick={checkout} disabled={placing} className="btn-primary w-full disabled:opacity-50">
            {placing ? 'جاري إتمام الطلب...' : isAuthenticated ? 'إتمام الشراء' : 'سجّل الدخول للشراء'}
          </button>
        </div>
      )}
    </main>
  )
}
