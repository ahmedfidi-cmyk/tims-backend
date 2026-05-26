'use client'

import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { InventoryItem } from '@/lib/utils/csv-parser'

function formatSar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', {
    style: 'currency',
    currency: 'SAR',
  })
}

const CONDITION_LABELS: Record<string, { ar: string; color: string }> = {
  excellent: { ar: 'ممتاز', color: 'bg-green-100 text-green-800' },
  good: { ar: 'جيد', color: 'bg-blue-100 text-blue-800' },
  fair: { ar: 'مقبول', color: 'bg-yellow-100 text-yellow-800' },
  poor: { ar: 'ضعيف', color: 'bg-red-100 text-red-800' },
}

export default function InventoryManagePage() {
  const { vendor, logout } = useVendorAuth()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [conditionFilter, setConditionFilter] = useState<string>('all')
  const [deletingImei, setDeletingImei] = useState<string | null>(null)

  const fetchInventory = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vendor/inventory')
      const data = await res.json()
      setItems(data.items || [])
    } catch (err) {
      console.error('Failed to fetch inventory', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInventory()
  }, [])

  const handleDelete = async (imei: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return
    setDeletingImei(imei)
    try {
      await fetch('/api/vendor/inventory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei }),
      })
      await fetchInventory()
    } finally {
      setDeletingImei(null)
    }
  }

  const filtered = items.filter(item => {
    const matchesSearch =
      !filter ||
      item.imei.includes(filter) ||
      item.model.toLowerCase().includes(filter.toLowerCase()) ||
      item.brand.toLowerCase().includes(filter.toLowerCase())
    const matchesCondition = conditionFilter === 'all' || item.condition === conditionFilter
    return matchesSearch && matchesCondition
  })

  const totalValue = filtered.reduce((sum, item) => sum + item.price * item.stock, 0)
  const totalStock = filtered.reduce((sum, item) => sum + item.stock, 0)

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <header className="bg-ink-900 text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">إدارة المخزون</h1>
            <p className="text-ink-900/70 text-sm">{vendor?.businessName}</p>
          </div>
          <button onClick={logout} className="px-4 py-2 bg-coral-500 rounded-lg hover:opacity-90">
            تسجيل الخروج
          </button>
        </div>
      </header>

      <nav className="bg-ink-900/80 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex gap-4">
            <Link href="/vendor/dashboard" className="text-white/60 hover:text-white">
              لوحة التحكم
            </Link>
            <Link href="/vendor/inventory/manage" className="text-gold-500 font-bold border-b-2 border-gold-500">
              المخزون
            </Link>
            <Link href="/vendor/orders/history" className="text-white/60 hover:text-white">
              الطلبات
            </Link>
            <Link href="/vendor/earnings/dashboard" className="text-white/60 hover:text-white">
              الأرباح
            </Link>
            <Link href="/vendor/profile/settings" className="text-white/60 hover:text-white">
              الملف الشخصي
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">عدد المنتجات</p>
            <p className="text-3xl font-bold text-ink-900">{items.length}</p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">إجمالي المخزون</p>
            <p className="text-3xl font-bold text-ink-900">{totalStock}</p>
          </div>
          <div className="card">
            <p className="text-ink-900/60 text-sm mb-2">قيمة المخزون</p>
            <p className="text-3xl font-bold text-coral-500">{formatSar(totalValue)}</p>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="🔍 ابحث برقم IMEI أو الموديل..."
              className="flex-1 px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
            />
            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
            >
              <option value="all">جميع الحالات</option>
              <option value="excellent">ممتاز</option>
              <option value="good">جيد</option>
              <option value="fair">مقبول</option>
              <option value="poor">ضعيف</option>
            </select>
            <Link href="/vendor/inventory/upload" className="btn-primary text-center">
              + إضافة منتج
            </Link>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <p className="text-center py-12 text-ink-900/60">جاري التحميل...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">📦</div>
              <p className="text-ink-900 mb-4">
                {items.length === 0 ? 'لا يوجد منتجات في المخزون' : 'لا توجد نتائج للبحث'}
              </p>
              {items.length === 0 && (
                <Link href="/vendor/inventory/upload" className="btn-primary inline-block">
                  ابدأ برفع المخزون
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-900/5 border-b border-ink-900/10">
                  <tr>
                    <th className="text-right p-4 font-semibold text-ink-900">IMEI</th>
                    <th className="text-right p-4 font-semibold text-ink-900">الموديل</th>
                    <th className="text-right p-4 font-semibold text-ink-900">الحالة</th>
                    <th className="text-right p-4 font-semibold text-ink-900">السعر</th>
                    <th className="text-right p-4 font-semibold text-ink-900">المخزون</th>
                    <th className="text-right p-4 font-semibold text-ink-900">القيمة</th>
                    <th className="text-right p-4 font-semibold text-ink-900"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.imei} className="border-b border-ink-900/5 hover:bg-ink-900/2 transition">
                      <td className="p-4 font-mono text-xs">{item.imei}</td>
                      <td className="p-4">
                        <p className="font-medium text-ink-900">{item.brand}</p>
                        <p className="text-xs text-ink-900/60">{item.model}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${CONDITION_LABELS[item.condition].color}`}>
                          {CONDITION_LABELS[item.condition].ar}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-coral-500">{formatSar(item.price)}</td>
                      <td className="p-4">
                        <span className={`font-bold ${item.stock === 0 ? 'text-red-600' : item.stock < 3 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {item.stock}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-ink-900">{formatSar(item.price * item.stock)}</td>
                      <td className="p-4">
                        <button
                          onClick={() => handleDelete(item.imei)}
                          disabled={deletingImei === item.imei}
                          className="text-red-600 hover:underline text-sm disabled:opacity-50"
                        >
                          {deletingImei === item.imei ? 'جاري...' : 'حذف'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
