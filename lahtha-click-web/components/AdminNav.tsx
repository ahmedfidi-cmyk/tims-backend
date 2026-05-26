'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAdminAuth } from '@/lib/contexts/admin-auth-context'

export function AdminNav() {
  const { admin, logout } = useAdminAuth()
  const pathname = usePathname()

  const links = [
    { href: '/admin/dashboard', label: 'لوحة التحكم' },
    { href: '/admin/vendors', label: 'البائعون' },
    { href: '/admin/kyc-approvals', label: 'طلبات التحقق' },
    { href: '/admin/analytics', label: 'التحليلات' },
  ]

  return (
    <>
      <header className="bg-ink-900 text-white p-6">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">👑 لوحة الإدارة</h1>
            <p className="text-white/60 text-sm">{admin?.email}</p>
          </div>
          <button onClick={logout} className="px-4 py-2 bg-coral-500 rounded-lg hover:opacity-90">
            تسجيل الخروج
          </button>
        </div>
      </header>
      <nav className="bg-white border-b border-ink-900/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex gap-4 overflow-x-auto">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap ${
                  pathname.startsWith(link.href)
                    ? 'text-coral-500 font-bold border-b-2 border-coral-500'
                    : 'text-ink-900/60 hover:text-ink-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </>
  )
}
