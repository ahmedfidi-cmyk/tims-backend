'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminNav } from '@/components/AdminNav'

interface DeviceRow {
  device: {
    deviceId: string
    imei: string
    modelName: string
    condition: string
    createdAt: string
  }
  state: string
  currentOwner: { ownerId: string; ownerType: string } | null
}

const CONDITION: Record<string, string> = {
  new_sealed: 'جديد مغلق', open_box: 'صندوق مفتوح', refurbished: 'مجدّد', used: 'مستعمل',
}
const STATE: Record<string, { text: string; bg: string }> = {
  with_vendor: { text: 'لدى البائع', bg: 'bg-blue-100 text-blue-800' },
  in_custody: { text: 'في العهدة', bg: 'bg-yellow-100 text-yellow-800' },
  sold: { text: 'مُباع', bg: 'bg-green-100 text-green-800' },
  with_dealer: { text: 'لدى تاجر', bg: 'bg-green-100 text-green-800' },
  unowned: { text: 'بدون مالك', bg: 'bg-ink-900/10 text-ink-900/70' },
}
const PAGE = 25

export default function AdminDevicesPage() {
  const [rows, setRows] = useState<DeviceRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((off: number) => {
    setLoading(true)
    setError(null)
    fetch(`/api/admin/devices?limit=${PAGE}&offset=${off}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return }
        setRows(d.items || [])
        setTotal(d.total || 0)
      })
      .catch(() => setError('تعذّر الاتصال بالخادم'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(offset) }, [offset, load])

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE, total)

  return (
    <div className="min-h-screen bg-paper-50">
      <AdminNav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-ink-900">الأجهزة المسجّلة</h2>
          <p className="text-sm text-ink-900/60">الإجمالي: {total}</p>
        </div>

        {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {loading ? (
          <p className="text-center py-12 text-ink-900/60">جاري التحميل...</p>
        ) : rows.length === 0 ? (
          <div className="card text-center py-12"><p className="text-ink-900/60">لا توجد أجهزة مسجّلة.</p></div>
        ) : (
          <>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ink-900/5 border-b border-ink-900/10">
                    <tr>
                      <th className="text-right p-4 font-semibold text-ink-900">IMEI</th>
                      <th className="text-right p-4 font-semibold text-ink-900">الموديل</th>
                      <th className="text-right p-4 font-semibold text-ink-900">الحالة</th>
                      <th className="text-right p-4 font-semibold text-ink-900">الوضع</th>
                      <th className="text-right p-4 font-semibold text-ink-900">التسجيل</th>
                      <th className="text-right p-4 font-semibold text-ink-900"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.device.deviceId} className="border-b border-ink-900/5 hover:bg-ink-900/2 transition">
                        <td className="p-4 font-mono text-xs">{r.device.imei}</td>
                        <td className="p-4">{r.device.modelName}</td>
                        <td className="p-4">{CONDITION[r.device.condition] ?? r.device.condition}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${STATE[r.state]?.bg ?? 'bg-ink-900/10'}`}>
                            {STATE[r.state]?.text ?? r.state}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-ink-900/60">{new Date(r.device.createdAt).toLocaleDateString('ar-SA')}</td>
                        <td className="p-4">
                          <Link href={`/admin/documents?imei=${r.device.imei}`} className="text-coral-500 hover:underline text-sm">
                            المستندات
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 text-sm">
              <p className="text-ink-900/60">عرض {from}–{to} من {total}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - PAGE))}
                  disabled={offset === 0}
                  className="btn-secondary px-4 py-1 disabled:opacity-40"
                >
                  السابق
                </button>
                <button
                  onClick={() => setOffset(offset + PAGE)}
                  disabled={to >= total}
                  className="btn-secondary px-4 py-1 disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
