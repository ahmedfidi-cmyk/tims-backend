'use client'

import { createContext, useCallback, useEffect, useState } from 'react'

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
  login: (email: string) => Promise<{ expires_in: number }>
  verify: (email: string, code: string) => Promise<{ token: string; vendor: Vendor }>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('vendor_token')
    const storedVendor = localStorage.getItem('vendor_data')
    if (storedToken && storedVendor) {
      setToken(storedToken)
      setVendor(JSON.parse(storedVendor))
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string) => {
    const res = await fetch('/api/vendor/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) throw new Error('Failed to send code')
    return res.json()
  }, [])

  const verify = useCallback(async (email: string, code: string) => {
    const res = await fetch('/api/vendor/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    if (!res.ok) throw new Error('Verification failed')
    const { token: newToken, vendor: newVendor } = await res.json()
    setToken(newToken)
    setVendor(newVendor)
    localStorage.setItem('vendor_token', newToken)
    localStorage.setItem('vendor_data', JSON.stringify(newVendor))
    return { token: newToken, vendor: newVendor }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setVendor(null)
    localStorage.removeItem('vendor_token')
    localStorage.removeItem('vendor_data')
  }, [])

  return (
    <AuthContext.Provider
      value={{
        vendor,
        token,
        isLoading,
        isAuthenticated: !!token,
        login,
        verify,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
