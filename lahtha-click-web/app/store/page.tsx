'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ListingView {
  listing: { listingId: string; priceHalalat: number; deviceId: string }
  device: { modelName: string; condition: string; imei: string } | null
}

function sar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })
}
const CONDITION: Record<string, string> = {
  new_sealed: 'جديد مغلق', open_box: 'صندوق مفتوح', refurbished: 'مجدّد', used: 'مستعمل',
}

export default function StorePage() {
  const [items, setItems] = useState<ListingView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/store/listings').then((r) => r.json()).then((d) => setItems(d.items || [])).finally(() => setLoading(false))
  }, [])

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink-900 mb-6">أجهزة Apple معتمدة</h1>
      {loading ? (
        <p className="text-center py-12 text-ink-900/60">جاري التحميل...</p>
      ) : items.length === 0 ? (
        <div className="card text-center py-12"><div className="text-5xl mb-3">🛍️</div><p className="text-ink-900/60">لا توجد عروض متاحة حالياً</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(({ listing, device }) => (
            <Link key={listing.listingId} href={`/store/${listing.listingId}`} className="card hover:shadow-lg transition block">
              <div className="bg-ink-900/5 h-36 rounded-lg mb-3 flex items-center justify-center text-5xl">📱</div>
              <h3 className="font-bold text-ink-900">{device?.modelName ?? 'جهاز'}</h3>
              <p className="text-xs text-ink-900/60 mb-2">{device ? CONDITION[device.condition] ?? device.condition : ''}</p>
              <p className="price">{sar(listing.priceHalalat)}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
