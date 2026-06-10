'use client'

import { createContext, useCallback, useEffect, useState } from 'react'
import { logger } from '@/lib/utils/logger'
import { validateEmail, validateCode, ValidationError } from '@/lib/utils/validation'

export interface Vendor {
  id: string
  email: string
  role: 'warehouse_manager' | 'owner'
  businessName: string
  warehouse: { address: string; lat: number; lng: number }
  kyc: { status: 'pending' | 'approved' | 'rejected'; verified_at?: string }
  commission_rate: number
}

interface AuthContextType {
  vendor: Vendor | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  login: (email: string) => Promise<{ expires_in: number; devCode?: string }>
  verify: (email: string, code: string) => Promise<{ token: string; vendor: Vendor | null }>
  logout: () => void
  clearError: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface Principal {
  userId: string
  principalType: string
  status: string
  roles: string[]
}

function principalToVendor(principal: Principal, emailFallback = ''): Vendor {
  return {
    id: principal.userId,
    email: emailFallback,
    role: principal.roles?.includes('vendor.warehouse_manager') ? 'warehouse_manager' : 'owner',
    businessName: emailFallback,
    warehouse: { address: '', lat: 0, lng: 0 },
    kyc: { status: principal.status === 'active' ? 'approved' : 'pending' },
    commission_rate: 0,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Hydrate auth state from the HttpOnly session cookie (which JS cannot read)
  // by asking the server who we are.
  const hydrate = useCallback(async (emailFallback?: string): Promise<Vendor | null> => {
    try {
      const res = await fetch('/api/vendor/auth/session', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (data?.authenticated && data.principal) {
        const v = principalToVendor(data.principal, emailFallback ?? vendor?.email ?? '')
        setVendor(v)
        return v
      }
      setVendor(null)
      return null
    } catch {
      setVendor(null)
      return null
    }
  }, [vendor?.email])

  useEffect(() => {
    void hydrate().finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (email: string) => {
    setError(null)
    try {
      if (!validateEmail(email)) throw new ValidationError('البريد الإلكتروني غير صحيح')
      logger.info('Vendor login attempt', { email })
      const res = await fetch('/api/vendor/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'فشل إرسال رمز التحقق')
      }
      return res.json()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ'
      setError(message)
      logger.error('Login failed', { email, error: message })
      throw err
    }
  }, [])

  const verify = useCallback(
    async (email: string, code: string) => {
      setError(null)
      try {
        if (!validateEmail(email)) throw new ValidationError('البريد الإلكتروني غير صحيح')
        if (!validateCode(code)) throw new ValidationError('رمز التحقق يجب أن يكون 6 أرقام')
        const res = await fetch('/api/vendor/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, code }),
        })
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || 'فشل التحقق')
        }
        // Session cookie is now set; hydrate the vendor from the server.
        const v = await hydrate(email)
        logger.info('Vendor authenticated', { email })
        return { token: '', vendor: v }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'فشل التحقق'
        setError(message)
        logger.error('Verification failed', { email, error: message })
        throw err
      }
    },
    [hydrate],
  )

  const logout = useCallback(() => {
    void fetch('/api/vendor/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    setVendor(null)
    setError(null)
    logger.info('Vendor logged out')
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return (
    <AuthContext.Provider
      value={{
        vendor,
        token: null,
        isLoading,
        isAuthenticated: !!vendor,
        error,
        login,
        verify,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
