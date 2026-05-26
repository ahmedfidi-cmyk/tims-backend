'use client'

import { FormEvent, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import { validateEmail } from '@/lib/utils/validation'

export default function VendorLoginPage() {
  const router = useRouter()
  const { login, error: authError, clearError } = useVendorAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    clearError()
  }, [clearError])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLocalError('')
    setSuccess(false)

    if (!email.trim()) {
      setLocalError('الرجاء إدخال البريد الإلكتروني')
      return
    }

    if (!validateEmail(email)) {
      setLocalError('البريد الإلكتروني غير صحيح')
      return
    }

    setLoading(true)

    try {
      await login(email)
      setSuccess(true)
      setTimeout(() => {
        router.push(`/vendor/auth/verify?email=${encodeURIComponent(email)}`)
      }, 1000)
    } catch (err) {
      setLocalError(authError || (err instanceof Error ? err.message : 'حدث خطأ'))
    } finally {
      setLoading(false)
    }
  }

  const displayError = localError || authError

  return (
    <div className="min-h-screen flex items-center justify-center bg-lahtha-pattern-dark px-4">
      <div className="card w-full max-w-md bg-white/95 backdrop-blur">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-ink-900 mb-2">بوابة البائع</h1>
          <p className="text-ink-900/60">سجل دخول حسابك التجاري</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-900 mb-2">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setLocalError('')
              }}
              placeholder="warehouse@example.com"
              disabled={loading || success}
              className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500 disabled:bg-ink-900/5 disabled:cursor-not-allowed"
              required
            />
          </div>

          {displayError && (
            <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm">
              {displayError}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-300 text-green-800 px-3 py-2 rounded-lg text-sm text-center">
              ✓ تم إرسال الرمز! جاري التوجيه...
            </div>
          )}

          <button
            type="submit"
            disabled={loading || success || !email.trim()}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ جاري الإرسال...' : success ? '✓ تم الإرسال' : 'إرسال رمز التحقق'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-ink-900/10 text-center text-sm text-ink-900/60">
          <p>حساب عميل؟ <a href="/" className="text-coral-500 hover:underline">عودة للرئيسية</a></p>
        </div>
      </div>
    </div>
  )
}
