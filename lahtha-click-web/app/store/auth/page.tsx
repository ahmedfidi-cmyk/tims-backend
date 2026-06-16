'use client'

import { FormEvent, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context'

function AuthInner() {
  const router = useRouter()
  const next = useSearchParams().get('next') || '/store'
  const { register, login, verify, error } = useCustomerAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const startAuth = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'register') await register(name, email, phone)
      const res = await login(email)
      setDevCode(res?.devCode ?? null)
      setStep('code')
    } catch { /* error via context */ } finally { setLoading(false) }
  }

  const submitCode = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await verify(email, code)
      router.push(next)
    } catch { /* error via context */ } finally { setLoading(false) }
  }

  const field = 'w-full px-3 py-2 border border-ink-900/20 rounded-lg focus:outline-none focus:border-coral-500'

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <div className="card">
        <div className="flex gap-2 mb-6 text-sm">
          <button onClick={() => { setMode('login'); setStep('form') }} className={`flex-1 py-2 rounded-lg ${mode === 'login' ? 'bg-ink-900 text-white' : 'bg-ink-900/5'}`}>تسجيل الدخول</button>
          <button onClick={() => { setMode('register'); setStep('form') }} className={`flex-1 py-2 rounded-lg ${mode === 'register' ? 'bg-ink-900 text-white' : 'bg-ink-900/5'}`}>حساب جديد</button>
        </div>

        {step === 'form' ? (
          <form onSubmit={startAuth} className="space-y-4">
            {mode === 'register' && (
              <>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className={field} required />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9665…" className={field} required />
              </>
            )}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" className={field} required />
            {error && <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? '...' : mode === 'register' ? 'إنشاء وإرسال الرمز' : 'إرسال رمز الدخول'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-4">
            <p className="text-sm text-ink-900/70">أُرسل رمز من 6 أرقام إلى {email}</p>
            <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" className={`${field} text-center tracking-widest font-mono`} required />
            {devCode && <div className="text-xs text-ink-900/60 bg-ink-900/5 p-2 rounded">رمز التطوير: <span className="font-mono">{devCode}</span></div>}
            {error && <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded-lg text-sm">{error}</div>}
            <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full disabled:opacity-50">{loading ? '...' : 'دخول'}</button>
          </form>
        )}
      </div>
    </main>
  )
}

export default function StoreAuthPage() {
  return (
    <Suspense fallback={<main className="max-w-md mx-auto px-4 py-10 text-center text-ink-900/60">...</main>}>
      <AuthInner />
    </Suspense>
  )
}
