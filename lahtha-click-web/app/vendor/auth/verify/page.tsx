'use client'

import { FormEvent, Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const { verify } = useVendorAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await verify(email, code)
      router.push('/vendor/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحقق')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-50 px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-3xl font-bold text-ink-900 mb-2">التحقق من الهوية</h1>
        <p className="text-ink-900/60 mb-6">
          أدخل رمز التحقق المرسل إلى {email}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-900 mb-2">
              رمز التحقق (6 أرقام)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500 text-center text-2xl tracking-widest"
              required
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'جاري التحقق...' : 'تحقق'}
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary w-full"
          >
            العودة
          </button>
        </form>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div>جاري التحميل...</div>}>
      <VerifyContent />
    </Suspense>
  )
}
