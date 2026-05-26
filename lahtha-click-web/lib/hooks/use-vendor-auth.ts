'use client'

import { useContext } from 'react'
import { AuthContext } from '../contexts/vendor-auth-context'

export function useVendorAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useVendorAuth must be used within AuthProvider')
  }
  return context
}
