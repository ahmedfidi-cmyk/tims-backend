'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { AdminNav } from '@/components/AdminNav'

interface Doc {
  documentId: string
  documentType: string
  mimeType: string
  sizeBytes: number
  sha256: string
  uploadedAt: string
  downloadUrl: string
  stub?: boolean
}
interface Device {
  deviceId: string
  imei: string
  modelName: string
  condition: string
}
interface Result {
  device: Device
  state: string
  currentOwner: { ownerId: string; ownerType: string } | null
  documents: Doc[]
}

const DOC_TYPE: Record<string, string> = {
  supplier_invoice: 'فاتورة المورّد',
  customs_clearance: 'تخليص جمركي',
  imei_certificate: 'شهادة IMEI',
  box_photo: 'صورة العلبة',
  other: 'أخرى',
}
const CONDITION: Record<string, string> = {
  new_sealed: 'جديد مغلق', open_box: 'صندوق مفتوح', refurbished: 'مجدّد', used: 'مستعمل',
}

function kb(bytes: number) {
  return `${(bytes / 1024).toLocaleString('ar-SA', { maximumFractionDigits: 1 })} كB`
}

export default function AdminDocumentsPage() {
  const [imei, setImei] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runSearch = useCallback(async (value: string) => {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/documents?imei=${encodeURIComponent(value)}`, { credentials: 'include' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error ?? 'تعذّر البحث'); return }
      setResult(d)
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }, [])

  // Prefill + auto-search when arriving from the device browser (?imei=...).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('imei')?.replace(/\D/g, '').slice(0, 15)
    if (q && q.length === 15) { setImei(q); void runSearch(q) }
  }, [runSearch])

  function search(e: FormEvent) {
    e.preventDefault()
    void runSearch(imei.trim())
  }

  return (
    <div className="min-h-screen bg-paper-50">
      <AdminNav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-ink-900 mb-2">مراجعة مستندات الأجهزة</h2>
        <p className="text-ink-900/60 text-sm mb-6">ابحث عن جهاز برقم IMEI لعرض مستنداته وتنزيلها للمراجعة.</p>

        <form onSubmit={search} className="card flex gap-2 mb-6">
          <input
            value={imei}
            onChange={(e) => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
            inputMode="numeric"
            placeholder="رقم IMEI (15 رقم)"
            className="flex-1 px-3 py-2 border border-ink-900/20 rounded-lg font-mono focus:outline-none focus:border-coral-500"
          />
          <button type="submit" disabled={loading || imei.length < 15} className="btn-primary px-6 disabled:opacity-50">
            {loading ? 'جارٍ البحث...' : 'بحث'}
          </button>
        </form>

        {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {result && (
          <>
            <div className="card mb-6">
              <h3 className="text-lg font-bold text-ink-900 mb-4">الجهاز</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-ink-900/60">IMEI</p><p className="font-mono text-ink-900">{result.device.imei}</p></div>
                <div><p className="text-ink-900/60">الموديل</p><p className="text-ink-900">{result.device.modelName}</p></div>
                <div><p className="text-ink-900/60">الحالة</p><p className="text-ink-900">{CONDITION[result.device.condition] ?? result.device.condition}</p></div>
                <div><p className="text-ink-900/60">المالك</p><p className="text-ink-900">{result.currentOwner?.ownerType ?? '—'}</p></div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-bold text-ink-900 mb-4">المستندات ({result.documents.length})</h3>
              {result.documents.length === 0 ? (
                <p className="text-ink-900/60 text-sm">لا توجد مستندات.</p>
              ) : (
                <div className="divide-y divide-ink-900/10">
                  {result.documents.map((d) => (
                    <div key={d.documentId} className="flex items-center justify-between py-3 gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-ink-900">{DOC_TYPE[d.documentType] ?? d.documentType}</p>
                        <p className="text-xs text-ink-900/50">
                          {d.mimeType} · {kb(d.sizeBytes)} · {new Date(d.uploadedAt).toLocaleDateString('ar-SA')}
                        </p>
                        <p className="text-[10px] text-ink-900/40 font-mono truncate">SHA-256: {d.sha256}</p>
                      </div>
                      {d.stub ? (
                        <span className="text-xs text-ink-900/50 whitespace-nowrap">التنزيل غير مُفعّل (وضع التطوير)</span>
                      ) : (
                        <a href={d.downloadUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs px-4 py-1 whitespace-nowrap">
                          تنزيل
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
