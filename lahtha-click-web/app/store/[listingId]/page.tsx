'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/lib/cart/cart-context'

interface ListingView {
  listing: { listingId: string; priceHalalat: number; status: string }
  device: { modelName: string; condition: string; imei: string } | null
}

function sar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })
}
const CONDITION: Record<string, string> = {
  new_sealed: 'جديد مغلق', open_box: 'صندوق مفتوح', refurbished: 'مجدّد', used: 'مستعمل',
}

export default function ProductPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = use(params)
  const router = useRouter()
  const { add, has } = useCart()
  const [data, setData] = useState<ListingView | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/store/listings/${listingId}`).then((r) => (r.ok ? r.json() : null)).then(setData).finally(() => setLoading(false))
  }, [listingId])

  if (loading) return <main className="max-w-3xl mx-auto px-4 py-12 text-center text-ink-900/60">جاري التحميل...</main>
  if (!data || data.listing.status !== 'active') {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-ink-900/60 mb-4">هذا العرض غير متاح</p>
        <Link href="/store" className="btn-primary inline-block">العودة للمتجر</Link>
      </main>
    )
  }

  const { listing, device } = data
  const inCart = has(listing.listingId)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/store" className="text-sm text-ink-900/60 hover:text-ink-900">← المتجر</Link>
      <div className="card mt-3">
        <div className="bg-ink-900/5 h-56 rounded-lg mb-4 flex items-center justify-center text-7xl">📱</div>
        <h1 className="text-2xl font-bold text-ink-900">{device?.modelName ?? 'جهاز'}</h1>
        <p className="text-ink-900/60 mb-1">الحالة: {device ? CONDITION[device.condition] ?? device.condition : '—'}</p>
        {device && <p className="text-xs font-mono text-ink-900/50 mb-3">IMEI: {device.imei}</p>}
        <p className="price text-2xl mb-6">{sar(listing.priceHalalat)}</p>
        <div className="flex gap-2">
          <button
            onClick={() => add({ listingId: listing.listingId, modelName: device?.modelName ?? 'جهاز', priceHalalat: listing.priceHalalat })}
            disabled={inCart}
            className="btn-secondary flex-1 disabled:opacity-50"
          >
            {inCart ? 'في السلة ✓' : 'أضف إلى السلة'}
          </button>
          <button
            onClick={() => {
              add({ listingId: listing.listingId, modelName: device?.modelName ?? 'جهاز', priceHalalat: listing.priceHalalat })
              router.push('/store/cart')
            }}
            className="btn-primary flex-1"
          >
            اشترِ الآن
          </button>
        </div>
      </div>
    </main>
  )
}
