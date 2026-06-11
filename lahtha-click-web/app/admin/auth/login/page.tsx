'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/lib/contexts/admin-auth-context'

export default function AdminLoginPage() {
  const router = useRouter()
  const { login, verify, error } = useAdminAuth()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await login(email)
      setDevCode(res?.devCode ?? null)
      setStep('code')
    } catch {
      // error surfaced via context
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      await verify(email, code)
      router.push('/admin/dashboard')
    } catch {
      // error surfaced via context
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-lahtha-pattern-dark px-4">
      <div className="card w-full max-w-md bg-white/95 backdrop-blur">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-ink-900 mb-1">👑 لوحة الإدارة</h1>
          <p className="text-ink-900/60 text-sm">LAHTHA &amp; CLICK</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-2">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@lahtha.sa"
                className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
                required
              />
            </div>
            {error && <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'جاري الإرسال...' : 'إرسال رمز الدخول'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm text-ink-900/70">أُرسل رمز مكوّن من 6 أرقام إلى {email}</p>
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-2">رمز التحقق</label>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full px-3 py-2 border border-ink-900/20 rounded-lg text-center tracking-widest font-mono focus:outline-none focus:border-coral-500"
                required
              />
            </div>
            {devCode && (
              <div className="text-xs text-ink-900/60 bg-ink-900/5 p-3 rounded-lg">
                💡 رمز التطوير: <span className="font-mono">{devCode}</span>
              </div>
            )}
            {error && <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm">{error}</div>}
            <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'جاري الدخول...' : 'دخول'}
            </button>
            <button type="button" onClick={() => setStep('email')} className="text-xs text-ink-900/60 hover:text-ink-900 w-full">
              تغيير البريد الإلكتروني
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
