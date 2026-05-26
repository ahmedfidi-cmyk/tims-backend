'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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

export default function DeviceDetailPage() {
  const params = useParams()
  const deviceId = params.id as string
  const [device, setDevice] = useState<DeviceListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)

  useEffect(() => {
    fetch('/api/devices')
      .then(r => r.json())
      .then(d => {
        const found = (d.items || []).find((x: DeviceListing) => x.id === deviceId)
        setDevice(found || null)
      })
      .finally(() => setLoading(false))
  }, [deviceId])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>
  }

  if (!device) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-50">
        <div className="card text-center">
          <p className="mb-4">الجهاز غير موجود</p>
          <Link href="/devices" className="btn-primary inline-block">عودة للمنتجات</Link>
        </div>
      </div>
    )
  }

  const monthlyTabby = Math.ceil(device.price / 100 / 4)

  return (
    <div className="min-h-screen bg-paper-50">
      <header className="bg-ink-900 text-white py-6 px-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/">
            <h1 className="text-2xl font-bold">LAHTHA & CLICK</h1>
          </Link>
          <nav className="flex gap-4">
            <Link href="/devices" className="text-white/70 hover:text-white">← العودة للمنتجات</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            <div className="card bg-ink-900/5 h-96 flex items-center justify-center text-9xl overflow-hidden mb-3">
              {device.images && device.images.length > 0 ? (
                <img src={device.images[activeImage]} alt={device.model} className="w-full h-full object-cover" />
              ) : (
                '📱'
              )}
            </div>
            {device.images && device.images.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {device.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`h-16 rounded-lg overflow-hidden border-2 ${
                      activeImage === idx ? 'border-coral-500' : 'border-ink-900/10'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <h1 className="text-3xl font-bold text-ink-900 mb-2">
              {device.brand} {device.model}
            </h1>
            <p className="text-ink-900/60 mb-4">
              IMEI: <span className="font-mono">{device.imei}</span>
            </p>

            <div className="card bg-coral-50 border-coral-200 mb-6">
              <p className="text-4xl font-bold text-coral-500">{formatSar(device.price)}</p>
              <p className="text-sm text-ink-900/70 mt-2">
                💳 أو {monthlyTabby.toLocaleString('ar-SA')} ر.س × 4 شهور مع Tabby / Tamara
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between border-b border-ink-900/10 pb-2">
                <span className="text-ink-900/60">الحالة</span>
                <span className="font-bold text-ink-900">{CONDITION_LABELS[device.condition]}</span>
              </div>
              <div className="flex justify-between border-b border-ink-900/10 pb-2">
                <span className="text-ink-900/60">الضمان</span>
                <span className="font-bold text-ink-900">3 أشهر</span>
              </div>
              <div className="flex justify-between border-b border-ink-900/10 pb-2">
                <span className="text-ink-900/60">المشاهدات</span>
                <span className="font-bold text-ink-900">{device.views}</span>
              </div>
            </div>

            {device.description && (
              <div className="card mb-6">
                <h3 className="font-bold text-ink-900 mb-2">الوصف</h3>
                <p className="text-ink-900/70 text-sm whitespace-pre-line">{device.description}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn-primary flex-1">🛒 أضف للسلة</button>
              <button className="btn-secondary flex-1">اشتر الآن</button>
            </div>

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
              <p className="font-bold text-green-800 mb-1">✓ ضمان LAHTHA</p>
              <ul className="text-green-700 space-y-1 text-xs">
                <li>• فحص الجهاز قبل الشحن</li>
                <li>• استرجاع كامل خلال 7 أيام</li>
                <li>• توصيل آمن في 1-2 يوم</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
