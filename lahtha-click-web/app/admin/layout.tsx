'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AdminAuthProvider, useAdminAuth } from '@/lib/contexts/admin-auth-context'

function AdminAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useAdminAuth()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated && !pathname.startsWith('/admin/auth')) {
      router.push('/admin/auth/login')
    }
  }, [isAuthenticated, isLoading, pathname, router])

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">جاري التحميل...</div>
  }

  return <>{children}</>
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminAuthGuard>{children}</AdminAuthGuard>
    </AdminAuthProvider>
  )
}
