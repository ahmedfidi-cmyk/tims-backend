'use client'

import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import { parseInventoryCSV, generateSampleCSV, ParseResult, InventoryItem } from '@/lib/utils/csv-parser'
import { validateIMEI } from '@/lib/utils/validation'
import Link from 'next/link'
import { FormEvent, useState, useRef } from 'react'

export default function InventoryUploadPage() {
  const { vendor, logout } = useVendorAuth()
  const [mode, setMode] = useState<'csv' | 'single'>('csv')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState<{ added: number; skipped: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Single entry form state
  const [singleForm, setSingleForm] = useState({
    imei: '',
    brand: 'Apple',
    model: '',
    condition: 'excellent' as InventoryItem['condition'],
    price: '',
    stock: '',
  })
  const [singleError, setSingleError] = useState('')
  const [singleSuccess, setSingleSuccess] = useState(false)

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setParseResult({
        valid: [],
        invalid: [{ row: 0, data: file.name, errors: ['ملف ليس CSV'] }],
        duplicates: [],
        totalRows: 0,
      })
      return
    }

    const text = await file.text()
    const result = parseInventoryCSV(text)
    setParseResult(result)
    setUploadSuccess(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleConfirmUpload = async () => {
    if (!parseResult || parseResult.valid.length === 0) return

    setUploading(true)
    try {
      const res = await fetch('/api/vendor/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parseResult.valid }),
      })
      const data = await res.json()
      setUploadSuccess({ added: data.added, skipped: data.skipped })
      setParseResult(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error('Upload failed', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadSample = () => {
    const blob = new Blob([generateSampleCSV()], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'inventory-sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSingleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSingleError('')
    setSingleSuccess(false)

    if (!validateIMEI(singleForm.imei)) {
      setSingleError('IMEI يجب أن يكون 15 رقم')
      return
    }
    const price = parseInt(singleForm.price, 10) * 100
    const stock = parseInt(singleForm.stock, 10)
    if (!price || price <= 0) {
      setSingleError('السعر يجب أن يكون أكبر من صفر')
      return
    }
    if (isNaN(stock) || stock < 0) {
      setSingleError('المخزون غير صحيح')
      return
    }

    try {
      const res = await fetch('/api/vendor/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            imei: singleForm.imei,
            brand: singleForm.brand,
            model: singleForm.model,
            condition: singleForm.condition,
            price,
            stock,
          }],
        }),
      })
      const data = await res.json()
      if (data.skipped > 0) {
        setSingleError('هذا IMEI مضاف مسبقاً')
      } else {
        setSingleSuccess(true)
        setSingleForm({
          imei: '',
          brand: 'Apple',
          model: '',
          condition: 'excellent',
          price: '',
          stock: '',
        })
        setTimeout(() => setSingleSuccess(false), 3000)
      }
    } catch (err) {
      setSingleError('حدث خطأ أثناء الإضافة')
    }
  }

  return (
    <div className="min-h-screen bg-paper-50">
      <header className="bg-ink-900 text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">رفع المخزون</h1>
            <p className="text-ink-900/70 text-sm">{vendor?.businessName}</p>
          </div>
          <button onClick={logout} className="px-4 py-2 bg-coral-500 rounded-lg hover:opacity-90">
            تسجيل الخروج
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-ink-900/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex gap-4">
            <Link href="/vendor/dashboard" className="text-ink-900/60 hover:text-ink-900">
              لوحة التحكم
            </Link>
            <Link href="/vendor/inventory/manage" className="text-ink-900/60 hover:text-ink-900">
              المخزون
            </Link>
            <Link href="/vendor/orders/history" className="text-ink-900/60 hover:text-ink-900">
              الطلبات
            </Link>
            <Link href="/vendor/earnings/dashboard" className="text-ink-900/60 hover:text-ink-900">
              الأرباح
            </Link>
            <Link href="/vendor/profile/settings" className="text-ink-900/60 hover:text-ink-900">
              الملف الشخصي
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('csv')}
            className={`px-4 py-2 rounded-lg font-medium ${
              mode === 'csv' ? 'bg-coral-500 text-white' : 'bg-white border border-ink-900/10 text-ink-900'
            }`}
          >
            📊 رفع ملف CSV
          </button>
          <button
            onClick={() => setMode('single')}
            className={`px-4 py-2 rounded-lg font-medium ${
              mode === 'single' ? 'bg-coral-500 text-white' : 'bg-white border border-ink-900/10 text-ink-900'
            }`}
          >
            ✏️ إدخال يدوي
          </button>
        </div>

        {/* Success Message */}
        {uploadSuccess && (
          <div className="card mb-6 bg-green-50 border-green-200">
            <p className="text-green-800 font-bold mb-2">✓ تم رفع المخزون بنجاح</p>
            <p className="text-green-700 text-sm">
              تمت إضافة {uploadSuccess.added} منتج
              {uploadSuccess.skipped > 0 && ` • تم تخطي ${uploadSuccess.skipped} منتج مكرر`}
            </p>
            <Link href="/vendor/inventory/manage" className="text-coral-500 hover:underline text-sm mt-2 inline-block">
              عرض المخزون ←
            </Link>
          </div>
        )}

        {mode === 'csv' && !parseResult && (
          <div className="card">
            <h2 className="text-xl font-bold text-ink-900 mb-4">رفع ملف CSV</h2>

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition ${
                dragOver ? 'border-coral-500 bg-coral-50' : 'border-ink-900/20 hover:border-coral-500'
              }`}
            >
              <div className="text-5xl mb-4">📁</div>
              <p className="text-lg font-medium text-ink-900 mb-2">
                اسحب الملف هنا أو انقر للاختيار
              </p>
              <p className="text-sm text-ink-900/60">
                صيغة CSV فقط (IMEI, brand, model, condition, price, stock)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-ink-900/60">
                لا تعرف الصيغة المطلوبة؟
              </p>
              <button onClick={handleDownloadSample} className="text-coral-500 hover:underline text-sm">
                ⬇ تحميل ملف نموذجي
              </button>
            </div>
          </div>
        )}

        {/* Parse Results */}
        {mode === 'csv' && parseResult && (
          <div className="card">
            <h2 className="text-xl font-bold text-ink-900 mb-4">معاينة الرفع</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-green-700">{parseResult.valid.length}</p>
                <p className="text-sm text-green-800">صالح</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-red-700">{parseResult.invalid.length}</p>
                <p className="text-sm text-red-800">خطأ</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-yellow-700">{parseResult.duplicates.length}</p>
                <p className="text-sm text-yellow-800">مكرر</p>
              </div>
            </div>

            {parseResult.invalid.length > 0 && (
              <div className="mb-6">
                <p className="font-bold text-ink-900 mb-2">أخطاء التحقق:</p>
                <div className="bg-red-50 p-4 rounded-lg max-h-48 overflow-y-auto text-sm">
                  {parseResult.invalid.slice(0, 10).map((err, i) => (
                    <div key={i} className="mb-2 pb-2 border-b border-red-200 last:border-0">
                      <p className="font-medium text-red-800">الصف {err.row}:</p>
                      <ul className="text-red-700 mr-4">
                        {err.errors.map((e, j) => (
                          <li key={j}>• {e}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parseResult.valid.length > 0 && (
              <div className="mb-6">
                <p className="font-bold text-ink-900 mb-2">أول 5 منتجات صالحة:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-ink-900/5">
                      <tr>
                        <th className="text-right p-2">IMEI</th>
                        <th className="text-right p-2">الموديل</th>
                        <th className="text-right p-2">الحالة</th>
                        <th className="text-right p-2">السعر</th>
                        <th className="text-right p-2">المخزون</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.valid.slice(0, 5).map((item, i) => (
                        <tr key={i} className="border-b border-ink-900/5">
                          <td className="p-2 font-mono text-xs">{item.imei}</td>
                          <td className="p-2">{item.brand} {item.model}</td>
                          <td className="p-2">{item.condition}</td>
                          <td className="p-2 font-bold">{(item.price / 100).toFixed(0)} ر.س</td>
                          <td className="p-2">{item.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setParseResult(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="btn-secondary flex-1"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={uploading || parseResult.valid.length === 0}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {uploading ? 'جاري الرفع...' : `رفع ${parseResult.valid.length} منتج`}
              </button>
            </div>
          </div>
        )}

        {mode === 'single' && (
          <div className="card">
            <h2 className="text-xl font-bold text-ink-900 mb-6">إضافة منتج واحد</h2>

            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-2">رقم IMEI (15 رقم)</label>
                <input
                  type="text"
                  value={singleForm.imei}
                  onChange={(e) => setSingleForm({ ...singleForm, imei: e.target.value.replace(/\D/g, '').slice(0, 15) })}
                  placeholder="358240010800000"
                  maxLength={15}
                  className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-900 mb-2">الماركة</label>
                  <input
                    type="text"
                    value={singleForm.brand}
                    onChange={(e) => setSingleForm({ ...singleForm, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-900 mb-2">الموديل</label>
                  <input
                    type="text"
                    value={singleForm.model}
                    onChange={(e) => setSingleForm({ ...singleForm, model: e.target.value })}
                    placeholder="iPhone 13"
                    className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-900 mb-2">الحالة</label>
                  <select
                    value={singleForm.condition}
                    onChange={(e) => setSingleForm({ ...singleForm, condition: e.target.value as InventoryItem['condition'] })}
                    className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                  >
                    <option value="excellent">ممتاز</option>
                    <option value="good">جيد</option>
                    <option value="fair">مقبول</option>
                    <option value="poor">ضعيف</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-900 mb-2">السعر (ر.س)</label>
                  <input
                    type="number"
                    value={singleForm.price}
                    onChange={(e) => setSingleForm({ ...singleForm, price: e.target.value })}
                    placeholder="899"
                    min="1"
                    className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-900 mb-2">المخزون</label>
                  <input
                    type="number"
                    value={singleForm.stock}
                    onChange={(e) => setSingleForm({ ...singleForm, stock: e.target.value })}
                    placeholder="1"
                    min="0"
                    className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                    required
                  />
                </div>
              </div>

              {singleError && (
                <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm">
                  {singleError}
                </div>
              )}

              {singleSuccess && (
                <div className="bg-green-100 border border-green-300 text-green-800 px-3 py-2 rounded-lg text-sm text-center">
                  ✓ تمت إضافة المنتج بنجاح
                </div>
              )}

              <button type="submit" className="btn-primary w-full">
                إضافة المنتج
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
