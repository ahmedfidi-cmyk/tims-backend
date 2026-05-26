'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'

export default function VendorLoginPage() {
  const router = useRouter()
  const { login } = useVendorAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email)
      router.push(`/vendor/auth/verify?email=${encodeURIComponent(email)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-50 px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-3xl font-bold text-ink-900 mb-2">بوابة البائع</h1>
        <p className="text-ink-900/60 mb-6">سجل دخول حسابك التجاري</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-900 mb-2">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="warehouse@example.com"
              className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
              required
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
          </button>
        </form>
      </div>
    </div>
  )
}
