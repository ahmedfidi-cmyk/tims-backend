'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'

const PUBLIC_ROUTES = ['/vendor/auth/login', '/vendor/auth/verify']

export default function VendorLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useVendorAuth()

  useEffect(() => {
    if (isLoading) return

    const isPublicRoute = PUBLIC_ROUTES.some((route) =>
      pathname.startsWith(route)
    )

    if (!isAuthenticated && !isPublicRoute) {
      router.push('/vendor/auth/login')
    }
  }, [isAuthenticated, isLoading, pathname, router])

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">جاري التحميل...</div>
  }

  return <>{children}</>
}
