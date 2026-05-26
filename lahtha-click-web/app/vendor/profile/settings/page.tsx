'use client'

import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import Link from 'next/link'
import { FormEvent, useState } from 'react'

export default function ProfileSettingsPage() {
  const { vendor, logout } = useVendorAuth()
  const [saved, setSaved] = useState(false)
  const [formData, setFormData] = useState({
    businessName: vendor?.businessName || '',
    warehouse_address: vendor?.warehouse.address || '',
    phone: '',
    email: vendor?.email || '',
  })

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="min-h-screen bg-paper-50">
      {/* Header */}
      <header className="bg-ink-900 text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">الملف الشخصي</h1>
            <p className="text-ink-900/70 text-sm">{vendor?.businessName}</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-coral-500 rounded-lg hover:opacity-90"
          >
            تسجيل الخروج
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-ink-900/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex gap-4">
            <Link href="/vendor/dashboard" className="text-ink-900/60 hover:text-ink-900">
              لوحة التحكم
            </Link>
            <Link href="/vendor/orders/history" className="text-ink-900/60 hover:text-ink-900">
              الطلبات
            </Link>
            <Link href="/vendor/earnings/dashboard" className="text-ink-900/60 hover:text-ink-900">
              الأرباح
            </Link>
            <Link href="/vendor/profile/settings" className="text-coral-500 font-bold border-b-2 border-coral-500">
              الملف الشخصي
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* KYC Status */}
        <div className="card mb-8 border-l-4 border-green-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-ink-900/60 mb-2">حالة التحقق</p>
              <p className="text-lg font-bold text-ink-900">✓ تم التحقق</p>
              <p className="text-xs text-ink-900/60 mt-1">
                تم التحقق في {vendor?.kyc.verified_at ? new Date(vendor.kyc.verified_at).toLocaleDateString('ar-SA') : 'N/A'}
              </p>
            </div>
            <Link
              href="/vendor/profile/kyc"
              className="btn-secondary text-sm"
            >
              عرض المستندات
            </Link>
          </div>
        </div>

        {/* Profile Form */}
        <div className="card">
          <h2 className="text-xl font-bold text-ink-900 mb-6">بيانات الحساب</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-2">
                اسم العمل التجاري
              </label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-900 mb-2">
                عنوان المستودع
              </label>
              <textarea
                value={formData.warehouse_address}
                onChange={(e) => setFormData({ ...formData, warehouse_address: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-900 mb-2">
                رقم الهاتف
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+966512345678"
                className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-900 mb-2">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-3 py-2 border border-ink-900/20 rounded-lg bg-ink-900/5 cursor-not-allowed"
              />
              <p className="text-xs text-ink-900/60 mt-1">لا يمكن تغيير البريد الإلكتروني</p>
            </div>

            {saved && (
              <div className="bg-green-100 border border-green-300 text-green-800 px-3 py-2 rounded-lg text-sm text-center">
                ✓ تم الحفظ بنجاح
              </div>
            )}

            <button type="submit" className="btn-primary w-full">
              حفظ التغييرات
            </button>
          </form>
        </div>

        {/* Password Section */}
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-ink-900 mb-6">الأمان</h2>
          <button className="btn-secondary w-full">
            تغيير كلمة المرور
          </button>
        </div>

        {/* Danger Zone */}
        <div className="card mt-6 border-2 border-red-200">
          <h2 className="text-xl font-bold text-red-600 mb-6">منطقة الخطر</h2>
          <button className="btn-secondary w-full text-red-600 border-red-300 hover:bg-red-50">
            حذف الحساب
          </button>
        </div>
      </main>
    </div>
  )
}
