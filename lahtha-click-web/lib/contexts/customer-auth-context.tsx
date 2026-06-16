'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export interface Customer {
  id: string
  email: string
}

interface CustomerAuthContextType {
  customer: Customer | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  register: (name: string, email: string, phone: string) => Promise<void>
  login: (email: string) => Promise<{ devCode?: string }>
  verify: (email: string, code: string) => Promise<void>
  logout: () => void
  clearError: () => void
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined)

interface Principal {
  userId: string
  principalType: string
  roles: string[]
}

function toCustomer(principal: Principal, emailFallback = ''): Customer | null {
  const ok = principal.principalType === 'customer' || principal.roles?.includes('customer.standard')
  if (!ok) return null
  return { id: principal.userId, email: emailFallback }
}

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hydrate = useCallback(async (emailFallback?: string): Promise<Customer | null> => {
    try {
      const res = await fetch('/api/customer/auth/session', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (data?.authenticated && data.principal) {
        const c = toCustomer(data.principal, emailFallback ?? customer?.email ?? '')
        setCustomer(c)
        return c
      }
      setCustomer(null)
      return null
    } catch {
      setCustomer(null)
      return null
    }
  }, [customer?.email])

  useEffect(() => {
    void hydrate().finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const post = async (path: string, body: unknown) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const message = data.error || 'حدث خطأ'
      setError(message)
      throw new Error(message)
    }
    return res.json()
  }

  const register = useCallback(async (name: string, email: string, phone: string) => {
    setError(null)
    await post('/api/customer/auth/register', { name, email, phone })
  }, [])

  const login = useCallback(async (email: string) => {
    setError(null)
    return post('/api/customer/auth/login', { email })
  }, [])

  const verify = useCallback(
    async (email: string, code: string) => {
      setError(null)
      await post('/api/customer/auth/verify', { email, code })
      const c = await hydrate(email)
      if (!c) {
        const message = 'هذا الحساب ليس حساب عميل'
        setError(message)
        throw new Error(message)
      }
    },
    [hydrate],
  )

  const logout = useCallback(() => {
    void fetch('/api/customer/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    setCustomer(null)
    setError(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return (
    <CustomerAuthContext.Provider
      value={{ customer, isLoading, isAuthenticated: !!customer, error, register, login, verify, logout, clearError }}
    >
      {children}
    </CustomerAuthContext.Provider>
  )
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider')
  return ctx
}
