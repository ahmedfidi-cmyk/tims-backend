'use client'

import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'

interface ModelEntry { modelCode: string; modelName: string }

const CONDITIONS: Array<{ value: string; label: string }> = [
  { value: 'new_sealed', label: 'جديد مغلق' },
  { value: 'open_box', label: 'صندوق مفتوح' },
  { value: 'refurbished', label: 'مجدّد' },
  { value: 'used', label: 'مستعمل' },
]

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function RegisterDevicePage() {
  const router = useRouter()
  const { vendor, logout } = useVendorAuth()
  const [models, setModels] = useState<ModelEntry[]>([])
  const [imei, setImei] = useState('')
  const [imei2, setImei2] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [modelCode, setModelCode] = useState('')
  const [storageGb, setStorageGb] = useState('')
  const [color, setColor] = useState('')
  const [condition, setCondition] = useState('new_sealed')
  const [invoice, setInvoice] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/vendor/models').then((r) => r.json()).then((d) => setModels(d.items || []))
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (!/^\d{15}$/.test(imei)) return setError('رقم IMEI يجب أن يكون 15 رقماً')
    if (!serialNumber.trim()) return setError('الرقم التسلسلي مطلوب')
    if (!modelCode) return setError('اختر موديل الجهاز')
    if (!invoice) return setError('أرفق فاتورة المورّد')

    setSubmitting(true)
    try {
      const body = {
        imei,
        ...(imei2 ? { imei2 } : {}),
        serialNumber: serialNumber.trim(),
        modelCode,
        ...(storageGb ? { storageGb: parseInt(storageGb, 10) } : {}),
        ...(color ? { color } : {}),
        condition,
        invoice: {
          documentType: 'supplier_invoice',
          s3Bucket: 'lahtha-device-docs',
          s3Key: `devices/pending/${imei}/invoice`,
          sha256: await sha256Hex(invoice),
          mimeType: invoice.type || 'application/pdf',
          sizeBytes: invoice.size,
        },
      }
      const res = await fetch('/api/vendor/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const reasons: Record<string, string> = {
          invalid_imei: 'رقم IMEI غير صالح (تحقق من الأرقام)',
          unknown_model: 'موديل غير معروف',
          device_conflict: 'هذا الجهاز مسجّل مسبقاً',
          forbidden: 'حسابك غير معتمد بعد لتسجيل الأجهزة',
          unauthenticated: 'يلزم تسجيل الدخول',
        }
        throw new Error(reasons[data?.error] ?? 'تعذّر تسجيل الجهاز')
      }
      router.push('/vendor/devices/list')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
      setSubmitting(false)
    }
  }

  const field = 'w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500'

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <header className="bg-ink-900 text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">تسجيل جهاز جديد</h1>
            <p className="text-ink-900/70 text-sm">{vendor?.businessName}</p>
          </div>
          <button onClick={logout} className="px-4 py-2 bg-coral-500 rounded-lg hover:opacity-90">تسجيل الخروج</button>
        </div>
      </header>

      <nav className="bg-ink-900/80 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex gap-4 overflow-x-auto">
            <Link href="/vendor/dashboard" className="text-white/60 hover:text-white whitespace-nowrap">لوحة التحكم</Link>
            <Link href="/vendor/devices/list" className="text-gold-500 font-bold border-b-2 border-gold-500 whitespace-nowrap">الأجهزة</Link>
            <Link href="/vendor/orders/history" className="text-white/60 hover:text-white whitespace-nowrap">الطلبات</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card space-y-4">
            <h2 className="text-xl font-bold text-ink-900">بيانات الجهاز</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-2">IMEI (15 رقم)</label>
                <input value={imei} onChange={(e) => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  inputMode="numeric" placeholder="350000000000000" className={`${field} font-mono`} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-2">IMEI الثاني (اختياري)</label>
                <input value={imei2} onChange={(e) => setImei2(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  inputMode="numeric" className={`${field} font-mono`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-2">الرقم التسلسلي</label>
                <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className={field} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-2">الموديل</label>
                <select value={modelCode} onChange={(e) => setModelCode(e.target.value)} className={field} required>
                  <option value="">اختر الموديل</option>
                  {models.map((m) => <option key={m.modelCode} value={m.modelCode}>{m.modelName} ({m.modelCode})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-2">السعة (GB، اختياري)</label>
                <input value={storageGb} onChange={(e) => setStorageGb(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric" className={field} />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-2">اللون (اختياري)</label>
                <input value={color} onChange={(e) => setColor(e.target.value)} className={field} />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-2">الحالة</label>
                <select value={condition} onChange={(e) => setCondition(e.target.value)} className={field}>
                  {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card space-y-2">
            <h2 className="text-xl font-bold text-ink-900">فاتورة المورّد (إلزامية)</h2>
            <p className="text-xs text-ink-900/60">يتم احتساب بصمة SHA-256 للملف للتحقق من سلامته. (تخزين الملف الفعلي قيد التفعيل.)</p>
            <input type="file" accept="application/pdf,image/*" onChange={(e) => setInvoice(e.target.files?.[0] ?? null)} required />
          </div>

          {error && <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm">{error}</div>}

          <div className="flex gap-2">
            <Link href="/vendor/devices/list" className="btn-secondary flex-1 text-center">إلغاء</Link>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">
              {submitting ? 'جاري التسجيل...' : 'تسجيل الجهاز'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
