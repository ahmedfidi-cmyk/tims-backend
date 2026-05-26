'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/lib/contexts/admin-auth-context'

export default function AdminLoginPage() {
  const router = useRouter()
  const { login } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      router.push('/admin/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-lahtha-pattern-dark px-4">
      <div className="card w-full max-w-md bg-white/95 backdrop-blur">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-ink-900 mb-1">👑 لوحة الإدارة</h1>
          <p className="text-ink-900/60 text-sm">LAHTHA & CLICK</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div>
            <label className="block text-sm font-medium text-ink-900 mb-2">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500"
              required
            />
          </div>

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>

          <div className="text-xs text-ink-900/60 bg-ink-900/5 p-3 rounded-lg mt-4">
            💡 بيانات تجريبية: <br />
            البريد: <span className="font-mono">admin@lahtha.sa</span><br />
            كلمة المرور: <span className="font-mono">admin123</span>
          </div>
        </form>
      </div>
    </div>
  )
}
