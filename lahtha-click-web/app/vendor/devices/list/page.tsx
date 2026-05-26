'use client'

import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DeviceListing } from '@/lib/mock/devices-data'

function formatSar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', {
    style: 'currency',
    currency: 'SAR',
  })
}

const STATUS_LABELS: Record<string, { ar: string; color: string }> = {
  active: { ar: 'نشط', color: 'bg-green-100 text-green-800' },
  paused: { ar: 'متوقف', color: 'bg-yellow-100 text-yellow-800' },
  sold: { ar: 'مباع', color: 'bg-blue-100 text-blue-800' },
  draft: { ar: 'مسودة', color: 'bg-gray-100 text-gray-800' },
}

export default function DevicesListPage() {
  const { vendor, logout } = useVendorAuth()
  const [devices, setDevices] = useState<DeviceListing[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchDevices = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vendor/devices')
      const data = await res.json()
      setDevices(data.items || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDevices() }, [])

  const handleStatusToggle = async (device: DeviceListing) => {
    const newStatus = device.status === 'active' ? 'paused' : 'active'
    await fetch('/api/vendor/devices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: device.id, status: newStatus }),
    })
    fetchDevices()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا الإعلان؟')) return
    await fetch('/api/vendor/devices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchDevices()
  }

  const filtered = statusFilter === 'all' ? devices : devices.filter(d => d.status === statusFilter)

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <header className="bg-ink-900 text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">إعلانات البيع</h1>
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
            <Link href="/vendor/profile/settings" className="text-white/60 hover:text-white whitespace-nowrap">الملف الشخصي</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">إجمالي الإعلانات</p>
            <p className="text-3xl font-bold text-ink-900">{devices.length}</p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">نشط</p>
            <p className="text-3xl font-bold text-green-600">{devices.filter(d => d.status === 'active').length}</p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">مباع</p>
            <p className="text-3xl font-bold text-blue-600">{devices.filter(d => d.status === 'sold').length}</p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">إجمالي المشاهدات</p>
            <p className="text-3xl font-bold text-coral-500">{devices.reduce((s, d) => s + d.views, 0)}</p>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
            >
              <option value="all">جميع الحالات</option>
              <option value="active">نشط</option>
              <option value="paused">متوقف</option>
              <option value="sold">مباع</option>
              <option value="draft">مسودة</option>
            </select>
            <Link href="/vendor/devices/create" className="btn-primary text-center flex-1 md:flex-none">
              + إعلان جديد
            </Link>
          </div>
        </div>

        {/* Devices Grid */}
        {loading ? (
          <p className="text-center py-12 text-ink-900/60">جاري التحميل...</p>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-5xl mb-4">📱</div>
            <p className="text-ink-900 mb-4">لا توجد إعلانات</p>
            <Link href="/vendor/devices/create" className="btn-primary inline-block">
              إنشاء أول إعلان
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(device => (
              <div key={device.id} className="card hover:shadow-lg transition">
                <div className="bg-ink-900/5 h-32 rounded-lg mb-3 flex items-center justify-center text-5xl overflow-hidden">
                  {device.images && device.images.length > 0 ? (
                    <img src={device.images[0]} alt={device.model} className="w-full h-full object-cover" />
                  ) : (
                    '📱'
                  )}
                </div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-ink-900">{device.brand} {device.model}</h3>
                    <p className="font-mono text-xs text-ink-900/60">{device.imei}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_LABELS[device.status].color}`}>
                    {STATUS_LABELS[device.status].ar}
                  </span>
                </div>
                <p className="price mb-2">{formatSar(device.price)}</p>
                <p className="text-xs text-ink-900/60 line-clamp-2 mb-3">{device.description}</p>
                <div className="flex justify-between text-xs text-ink-900/60 mb-3">
                  <span>👁 {device.views} مشاهدة</span>
                  <span>{new Date(device.created_at).toLocaleDateString('ar-SA')}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStatusToggle(device)}
                    className="btn-secondary flex-1 text-xs"
                  >
                    {device.status === 'active' ? 'إيقاف' : 'تفعيل'}
                  </button>
                  <button
                    onClick={() => handleDelete(device.id)}
                    className="text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-xs font-medium"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
