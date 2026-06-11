'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export interface Admin {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'operations'
}

interface AdminAuthContextType {
  admin: Admin | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  login: (email: string) => Promise<{ devCode?: string }>
  verify: (email: string, code: string) => Promise<void>
  logout: () => void
  clearError: () => void
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

interface Principal {
  userId: string
  roles: string[]
}

// Only a principal holding an admin.* role counts as an authenticated admin.
function principalToAdmin(principal: Principal, emailFallback = ''): Admin | null {
  const adminRole = principal.roles?.find((r) => r.startsWith('admin.'))
  if (!adminRole) return null
  return {
    id: principal.userId,
    email: emailFallback,
    name: emailFallback,
    role: adminRole === 'admin.ops' ? 'operations' : 'super_admin',
  }
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hydrate = useCallback(async (emailFallback?: string): Promise<Admin | null> => {
    try {
      const res = await fetch('/api/admin/auth/session', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (data?.authenticated && data.principal) {
        const a = principalToAdmin(data.principal, emailFallback ?? admin?.email ?? '')
        setAdmin(a)
        return a
      }
      setAdmin(null)
      return null
    } catch {
      setAdmin(null)
      return null
    }
  }, [admin?.email])

  useEffect(() => {
    void hydrate().finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (email: string) => {
    setError(null)
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const message = data.error || 'فشل إرسال الرمز'
      setError(message)
      throw new Error(message)
    }
    return res.json()
  }, [])

  const verify = useCallback(
    async (email: string, code: string) => {
      setError(null)
      const res = await fetch('/api/admin/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message = data.error || 'فشل التحقق'
        setError(message)
        throw new Error(message)
      }
      const a = await hydrate(email)
      if (!a) {
        const message = 'هذا الحساب ليس لديه صلاحية إدارية'
        setError(message)
        throw new Error(message)
      }
    },
    [hydrate],
  )

  const logout = useCallback(() => {
    void fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    setAdmin(null)
    setError(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        token: null,
        isLoading,
        isAuthenticated: !!admin,
        error,
        login,
        verify,
        logout,
        clearError,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
