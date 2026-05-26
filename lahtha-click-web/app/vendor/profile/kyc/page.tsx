'use client'

import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

const STEPS = [
  { num: 1, label: 'البيانات الشخصية', icon: '👤' },
  { num: 2, label: 'بيانات العمل', icon: '🏢' },
  { num: 3, label: 'المستندات', icon: '📄' },
  { num: 4, label: 'الحساب البنكي', icon: '🏦' },
]

export default function KycWizardPage() {
  const router = useRouter()
  const { vendor, logout } = useVendorAuth()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [data, setData] = useState({
    // Step 1
    fullName: '',
    nationalId: '',
    dob: '',
    nationality: 'سعودي',
    // Step 2
    businessName: vendor?.businessName || '',
    crNumber: '',
    vatNumber: '',
    warehouseAddress: vendor?.warehouse.address || '',
    // Step 3
    idUploaded: false,
    crUploaded: false,
    selfieUploaded: false,
    // Step 4
    iban: '',
    bankName: '',
    accountHolder: '',
  })

  const submitStep = async (stepNum: number) => {
    setSubmitting(true)
    setError('')
    try {
      await fetch('/api/vendor/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepNum, data }),
      })
      if (stepNum < 4) {
        setStep(stepNum + 1)
      } else {
        router.push('/vendor/profile/settings?kyc=submitted')
      }
    } catch (err) {
      setError('حدث خطأ')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    submitStep(step)
  }

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <header className="bg-ink-900 text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">التحقق من الهوية (KYC)</h1>
            <p className="text-ink-900/70 text-sm">إكمال التحقق ضروري لاستلام الأرباح</p>
          </div>
          <button onClick={logout} className="px-4 py-2 bg-coral-500 rounded-lg hover:opacity-90">
            تسجيل الخروج
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Step Progress */}
        <div className="card mb-6">
          <div className="flex justify-between">
            {STEPS.map((s, idx) => (
              <div key={s.num} className="flex flex-col items-center flex-1 relative">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mb-2 ${
                    s.num < step
                      ? 'bg-green-500 text-white'
                      : s.num === step
                        ? 'bg-coral-500 text-white'
                        : 'bg-ink-900/10 text-ink-900/40'
                  }`}
                >
                  {s.num < step ? '✓' : s.icon}
                </div>
                <p
                  className={`text-xs text-center ${
                    s.num <= step ? 'text-ink-900 font-medium' : 'text-ink-900/40'
                  }`}
                >
                  {s.label}
                </p>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`absolute top-6 left-[-50%] right-[50%] h-1 -z-10 ${
                      s.num < step ? 'bg-green-500' : 'bg-ink-900/10'
                    }`}
                    style={{ width: 'calc(100% - 3rem)' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Forms */}
        <form onSubmit={handleSubmit} className="card">
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold text-ink-900 mb-6">١. البيانات الشخصية</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink-900 mb-2">الاسم الكامل</label>
                  <input
                    type="text"
                    value={data.fullName}
                    onChange={(e) => setData({ ...data, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-900 mb-2">رقم الهوية</label>
                    <input
                      type="text"
                      value={data.nationalId}
                      onChange={(e) => setData({ ...data, nationalId: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      maxLength={10}
                      placeholder="1234567890"
                      className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-900 mb-2">تاريخ الميلاد</label>
                    <input
                      type="date"
                      value={data.dob}
                      onChange={(e) => setData({ ...data, dob: e.target.value })}
                      className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-900 mb-2">الجنسية</label>
                  <select
                    value={data.nationality}
                    onChange={(e) => setData({ ...data, nationality: e.target.value })}
                    className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                  >
                    <option>سعودي</option>
                    <option>مقيم</option>
                    <option>أخرى</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-bold text-ink-900 mb-6">٢. بيانات العمل</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink-900 mb-2">اسم العمل التجاري</label>
                  <input
                    type="text"
                    value={data.businessName}
                    onChange={(e) => setData({ ...data, businessName: e.target.value })}
                    className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-900 mb-2">السجل التجاري</label>
                    <input
                      type="text"
                      value={data.crNumber}
                      onChange={(e) => setData({ ...data, crNumber: e.target.value })}
                      placeholder="1010123456"
                      className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-900 mb-2">الرقم الضريبي (اختياري)</label>
                    <input
                      type="text"
                      value={data.vatNumber}
                      onChange={(e) => setData({ ...data, vatNumber: e.target.value })}
                      placeholder="300123456700003"
                      className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-900 mb-2">عنوان المستودع</label>
                  <textarea
                    value={data.warehouseAddress}
                    onChange={(e) => setData({ ...data, warehouseAddress: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl font-bold text-ink-900 mb-6">٣. رفع المستندات</h2>
              <div className="space-y-4">
                {[
                  { key: 'idUploaded', label: 'صورة الهوية الوطنية', icon: '🆔' },
                  { key: 'crUploaded', label: 'السجل التجاري', icon: '📋' },
                  { key: 'selfieUploaded', label: 'سيلفي مع الهوية', icon: '🤳' },
                ].map(doc => (
                  <div
                    key={doc.key}
                    className={`border-2 border-dashed rounded-lg p-6 cursor-pointer transition ${
                      data[doc.key as keyof typeof data]
                        ? 'border-green-500 bg-green-50'
                        : 'border-ink-900/20 hover:border-coral-500'
                    }`}
                    onClick={() => setData({ ...data, [doc.key]: !data[doc.key as keyof typeof data] })}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{doc.icon}</div>
                        <div>
                          <p className="font-bold text-ink-900">{doc.label}</p>
                          <p className="text-xs text-ink-900/60">
                            {data[doc.key as keyof typeof data] ? '✓ تم الرفع' : 'انقر للرفع'}
                          </p>
                        </div>
                      </div>
                      <div className="text-2xl">
                        {data[doc.key as keyof typeof data] ? '✓' : '📁'}
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-ink-900/60 bg-ink-900/5 p-3 rounded-lg">
                  💡 ملاحظة: في هذا العرض التوضيحي يكفي النقر للمحاكاة. سيتم رفع الملفات الحقيقية في المرحلة القادمة.
                </p>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-xl font-bold text-ink-900 mb-6">٤. الحساب البنكي</h2>
              <p className="text-sm text-ink-900/60 mb-4">
                سيتم تحويل أرباحك إلى هذا الحساب أسبوعياً
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink-900 mb-2">رقم الآيبان (IBAN)</label>
                  <input
                    type="text"
                    value={data.iban}
                    onChange={(e) => setData({ ...data, iban: e.target.value.toUpperCase() })}
                    placeholder="SA0000000000000000000000"
                    maxLength={24}
                    className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-900 mb-2">اسم البنك</label>
                  <select
                    value={data.bankName}
                    onChange={(e) => setData({ ...data, bankName: e.target.value })}
                    className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                    required
                  >
                    <option value="">اختر البنك</option>
                    <option>البنك الأهلي السعودي</option>
                    <option>الراجحي</option>
                    <option>الرياض</option>
                    <option>سامبا</option>
                    <option>البنك السعودي الفرنسي</option>
                    <option>ساب</option>
                    <option>الإنماء</option>
                    <option>أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-900 mb-2">اسم صاحب الحساب</label>
                  <input
                    type="text"
                    value={data.accountHolder}
                    onChange={(e) => setData({ ...data, accountHolder: e.target.value })}
                    className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm mt-4">
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                disabled={submitting}
                className="btn-secondary flex-1"
              >
                السابق
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {submitting ? 'جاري الإرسال...' : step === 4 ? 'إرسال الطلب' : 'التالي'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
