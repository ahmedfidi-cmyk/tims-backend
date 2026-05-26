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
  login: (email: string) => Promise<{ expires_in: number }>
  verify: (email: string, code: string) => Promise<{ token: string; vendor: Vendor }>
  logout: () => void
  clearError: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('vendor_token')
      const storedVendor = localStorage.getItem('vendor_data')
      if (storedToken && storedVendor) {
        setToken(storedToken)
        setVendor(JSON.parse(storedVendor))
        logger.info('Auth session restored from localStorage', { vendorId: JSON.parse(storedVendor).id })
      }
    } catch (err) {
      logger.warn('Failed to restore auth session', { error: String(err) })
      localStorage.removeItem('vendor_token')
      localStorage.removeItem('vendor_data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string) => {
    setError(null)
    try {
      if (!validateEmail(email)) {
        throw new ValidationError('البريد الإلكتروني غير صحيح')
      }

      logger.info('Vendor login attempt', { email })

      const res = await fetch('/api/vendor/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'فشل إرسال رمز التحقق')
      }

      const data = await res.json()
      logger.info('Login code sent', { email })
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ'
      setError(message)
      logger.error('Login failed', { email, error: message })
      throw err
    }
  }, [])

  const verify = useCallback(async (email: string, code: string) => {
    setError(null)
    try {
      if (!validateEmail(email)) {
        throw new ValidationError('البريد الإلكتروني غير صحيح')
      }
      if (!validateCode(code)) {
        throw new ValidationError('رمز التحقق يجب أن يكون 6 أرقام')
      }

      logger.info('Vendor verification attempt', { email })

      const res = await fetch('/api/vendor/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'فشل التحقق')
      }

      const { token: newToken, vendor: newVendor } = await res.json()
      setToken(newToken)
      setVendor(newVendor)
      localStorage.setItem('vendor_token', newToken)
      localStorage.setItem('vendor_data', JSON.stringify(newVendor))
      logger.info('Vendor authenticated', { vendorId: newVendor.id, email })
      return { token: newToken, vendor: newVendor }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل التحقق'
      setError(message)
      logger.error('Verification failed', { email, error: message })
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setVendor(null)
    setError(null)
    localStorage.removeItem('vendor_token')
    localStorage.removeItem('vendor_data')
    logger.info('Vendor logged out')
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        vendor,
        token,
        isLoading,
        isAuthenticated: !!token,
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
