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
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('admin_token')
      const storedAdmin = localStorage.getItem('admin_data')
      if (storedToken && storedAdmin) {
        setToken(storedToken)
        setAdmin(JSON.parse(storedAdmin))
      }
    } catch (_) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'فشل تسجيل الدخول')
    }
    const { token: t, admin: a } = await res.json()
    setToken(t)
    setAdmin(a)
    localStorage.setItem('admin_token', t)
    localStorage.setItem('admin_data', JSON.stringify(a))
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setAdmin(null)
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_data')
  }, [])

  return (
    <AdminAuthContext.Provider
      value={{ admin, token, isLoading, isAuthenticated: !!token, login, logout }}
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
