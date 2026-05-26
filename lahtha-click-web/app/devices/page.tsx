'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DeviceListing } from '@/lib/mock/devices-data'

function formatSar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', {
    style: 'currency',
    currency: 'SAR',
  })
}

const CONDITION_LABELS: Record<string, string> = {
  excellent: 'ممتاز',
  good: 'جيد',
  fair: 'مقبول',
  poor: 'ضعيف',
}

export default function CustomerDevicesPage() {
  const [devices, setDevices] = useState<DeviceListing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/devices')
      .then(r => r.json())
      .then(d => setDevices(d.items || []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = devices.filter(d =>
    !search ||
    d.brand.toLowerCase().includes(search.toLowerCase()) ||
    d.model.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-paper-50">
      <header className="bg-ink-900 text-white py-6 px-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/">
            <h1 className="text-2xl font-bold">LAHTHA & CLICK</h1>
          </Link>
          <nav className="flex gap-4">
            <Link href="/devices" className="text-gold-500 font-bold">المنتجات</Link>
            <Link href="/vendor/auth/login" className="text-white/70 hover:text-white">بوابة البائع</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-ink-900 mb-2">تسوّق أجهزة أبل</h2>
          <p className="text-ink-900/70">أجهزة موثوقة من بائعين معتمدين</p>
        </div>

        <div className="card mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 ابحث عن جهاز..."
            className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
          />
        </div>

        {loading ? (
          <p className="text-center py-12 text-ink-900/60">جاري التحميل...</p>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-5xl mb-4">📱</div>
            <p className="text-ink-900">لا توجد منتجات متاحة حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(device => (
              <Link
                key={device.id}
                href={`/devices/${device.id}`}
                className="card hover:shadow-lg transition block"
              >
                <div className="bg-ink-900/5 h-48 rounded-lg mb-3 flex items-center justify-center text-6xl overflow-hidden">
                  {device.images && device.images.length > 0 ? (
                    <img src={device.images[0]} alt={device.model} className="w-full h-full object-cover" />
                  ) : (
                    '📱'
                  )}
                </div>
                <h3 className="font-bold text-ink-900 mb-1">{device.brand} {device.model}</h3>
                <p className="text-sm text-ink-900/60 mb-2">حالة: {CONDITION_LABELS[device.condition]}</p>
                <p className="price">{formatSar(device.price)}</p>
                <p className="text-xs text-coral-500 mt-2">
                  أو {(Math.ceil(device.price / 100 / 4)).toLocaleString('ar-SA')} ر.س × 4 (Tabby/Tamara)
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
