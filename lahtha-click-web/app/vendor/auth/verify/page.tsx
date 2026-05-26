'use client'

import { FormEvent, Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import { validateCode } from '@/lib/utils/validation'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const { verify, error: authError, clearError } = useVendorAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState('')
  const [success, setSuccess] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)

  useEffect(() => {
    clearError()
  }, [clearError])

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCountdown])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLocalError('')
    setSuccess(false)

    if (!validateCode(code)) {
      setLocalError('رمز التحقق يجب أن يكون 6 أرقام')
      return
    }

    if (!email) {
      setLocalError('البريد الإلكتروني مفقود')
      return
    }

    setLoading(true)

    try {
      await verify(email, code)
      setSuccess(true)
      setTimeout(() => {
        router.push('/vendor/dashboard')
      }, 1000)
    } catch (err) {
      setLocalError(authError || (err instanceof Error ? err.message : 'فشل التحقق'))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    try {
      const res = await fetch('/api/vendor/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setResendCountdown(60)
        setLocalError('')
      } else {
        setLocalError('فشل إعادة الإرسال')
      }
    } catch (err) {
      setLocalError('حدث خطأ في إعادة الإرسال')
    }
  }

  const displayError = localError || authError

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-50 px-4">
      <div className="card w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-ink-900 mb-2">التحقق من الهوية</h1>
          <p className="text-ink-900/60 text-sm break-all">
            أدخل الرمز المرسل إلى <br /> {email}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-900 mb-2">
              رمز التحقق (6 أرقام)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCode(cleaned)
                setLocalError('')
              }}
              placeholder="000000"
              maxLength={6}
              disabled={loading || success}
              className="w-full px-3 py-2 border-2 border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500 text-center text-4xl tracking-widest font-bold disabled:bg-ink-900/5 disabled:cursor-not-allowed"
              required
              autoFocus
            />
          </div>

          {displayError && (
            <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm">
              {displayError}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-300 text-green-800 px-3 py-2 rounded-lg text-sm text-center">
              ✓ تم التحقق! جاري دخول لوحة التحكم...
            </div>
          )}

          <button
            type="submit"
            disabled={loading || success || code.length !== 6}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ جاري التحقق...' : success ? '✓ تم التحقق' : 'تحقق'}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary flex-1"
              disabled={loading || success}
            >
              العودة
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCountdown > 0 || loading || success}
              className="btn-secondary flex-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendCountdown > 0 ? `إعادة إرسال (${resendCountdown})` : 'إرسال مجدداً'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">جاري التحميل...</div>}>
      <VerifyContent />
    </Suspense>
  )
}
