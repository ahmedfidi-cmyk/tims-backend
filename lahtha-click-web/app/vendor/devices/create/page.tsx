'use client'

import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { InventoryItem } from '@/lib/utils/csv-parser'
import { ImageUploader } from '@/components/ImageUploader'

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

export default function CreateDevicePage() {
  const router = useRouter()
  const { vendor, logout } = useVendorAuth()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [selectedImei, setSelectedImei] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/vendor/inventory')
      .then(r => r.json())
      .then(d => setInventory(d.items || []))
  }, [])

  const selected = inventory.find(i => i.imei === selectedImei)

  useEffect(() => {
    if (selected && !price) {
      setPrice((selected.price / 100).toString())
    }
  }, [selected, price])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (!selected) {
      setError('اختر منتجاً من المخزون')
      return
    }

    const priceHalalat = parseInt(price, 10) * 100
    if (!priceHalalat || priceHalalat <= 0) {
      setError('السعر غير صحيح')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/vendor/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imei: selected.imei,
          brand: selected.brand,
          model: selected.model,
          condition: selected.condition,
          price: priceHalalat,
          description,
          images,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      router.push('/vendor/devices/list')
    } catch (err) {
      setError('حدث خطأ أثناء إنشاء الإعلان')
    } finally {
      setSubmitting(false)
    }
  }

  const commission = price ? Math.round(parseInt(price, 10) * 0.05) : 0
  const net = price ? parseInt(price, 10) - commission : 0

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <header className="bg-ink-900 text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">إنشاء إعلان جديد</h1>
            <p className="text-ink-900/70 text-sm">{vendor?.businessName}</p>
          </div>
          <button onClick={logout} className="px-4 py-2 bg-coral-500 rounded-lg hover:opacity-90">
            تسجيل الخروج
          </button>
        </div>
      </header>

      <nav className="bg-ink-900/80 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex gap-4 overflow-x-auto">
            <Link href="/vendor/dashboard" className="text-white/60 hover:text-white whitespace-nowrap">لوحة التحكم</Link>
            <Link href="/vendor/inventory/manage" className="text-white/60 hover:text-white whitespace-nowrap">المخزون</Link>
            <Link href="/vendor/devices/list" className="text-gold-500 font-bold border-b-2 border-gold-500 whitespace-nowrap">الإعلانات</Link>
            <Link href="/vendor/orders/history" className="text-white/60 hover:text-white whitespace-nowrap">الطلبات</Link>
            <Link href="/vendor/earnings/dashboard" className="text-white/60 hover:text-white whitespace-nowrap">الأرباح</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select from Inventory */}
          <div className="card">
            <h2 className="text-xl font-bold text-ink-900 mb-4">١. اختر منتجاً من المخزون</h2>
            {inventory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-ink-900/60 mb-4">لا يوجد منتجات في المخزون</p>
                <Link href="/vendor/inventory/upload" className="btn-primary inline-block">
                  رفع المخزون أولاً
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inventory.map(item => (
                  <label
                    key={item.imei}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                      selectedImei === item.imei
                        ? 'border-coral-500 bg-coral-50'
                        : 'border-ink-900/10 hover:border-coral-500/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="imei"
                      value={item.imei}
                      checked={selectedImei === item.imei}
                      onChange={(e) => setSelectedImei(e.target.value)}
                      className="sr-only"
                    />
                    <p className="font-bold text-ink-900">{item.brand} {item.model}</p>
                    <p className="text-xs text-ink-900/60 font-mono">{item.imei}</p>
                    <div className="flex justify-between mt-2 text-xs">
                      <span>{CONDITION_LABELS[item.condition]}</span>
                      <span className="font-bold text-coral-500">{formatSar(item.price)}</span>
                    </div>
                    <p className="text-xs text-ink-900/60 mt-1">المخزون: {item.stock}</p>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Listing Details */}
          {selected && (
            <>
              <div className="card">
                <h2 className="text-xl font-bold text-ink-900 mb-4">٢. تفاصيل الإعلان</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-900 mb-2">السعر (ر.س)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      min="1"
                      className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-900 mb-2">الوصف</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="اكتب وصفاً تفصيلياً للجهاز: الحالة، الإكسسوارات، البطارية..."
                      className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-900 mb-2">صور الجهاز</label>
                    <ImageUploader images={images} onChange={setImages} maxImages={5} maxSizeMB={2} />
                  </div>
                </div>
              </div>

              {/* Step 3: Commission Preview */}
              {price && (
                <div className="card bg-gold-500/5 border-gold-500/30">
                  <h2 className="text-xl font-bold text-ink-900 mb-4">٣. ملخص الأرباح</h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ink-900/60">سعر البيع</span>
                      <span className="font-bold text-ink-900">{parseInt(price, 10).toLocaleString('ar-SA')} ر.س</span>
                    </div>
                    <div className="flex justify-between border-t border-ink-900/10 pt-2">
                      <span className="text-ink-900/60">عمولة LAHTHA (5%)</span>
                      <span className="font-bold text-coral-500">-{commission.toLocaleString('ar-SA')} ر.س</span>
                    </div>
                    <div className="flex justify-between border-t border-ink-900/10 pt-2 text-lg">
                      <span className="font-bold text-ink-900">صافي الأرباح</span>
                      <span className="font-bold text-gold-500">{net.toLocaleString('ar-SA')} ر.س</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Link href="/vendor/devices/list" className="btn-secondary flex-1 text-center">
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={!selected || !price || submitting}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {submitting ? 'جاري النشر...' : 'نشر الإعلان'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
