'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { CustomerAuthProvider, useCustomerAuth } from '@/lib/contexts/customer-auth-context'
import { CartProvider, useCart } from '@/lib/cart/cart-context'

function StoreHeader() {
  const { isAuthenticated, customer, logout } = useCustomerAuth()
  const { items } = useCart()
  return (
    <header className="bg-ink-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/store" className="text-xl font-bold">لحظة — المتجر</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/store/cart" className="hover:text-gold-500">السلة {items.length > 0 && <span className="bg-coral-500 rounded-full px-2 py-0.5 text-xs">{items.length}</span>}</Link>
          {isAuthenticated ? (
            <>
              <Link href="/store/orders" className="hover:text-gold-500">طلباتي</Link>
              <span className="text-white/60 text-xs">{customer?.email}</span>
              <button onClick={logout} className="bg-coral-500 rounded-lg px-3 py-1 hover:opacity-90">خروج</button>
            </>
          ) : (
            <Link href="/store/auth" className="bg-coral-500 rounded-lg px-3 py-1 hover:opacity-90">دخول</Link>
          )}
        </div>
      </div>
    </header>
  )
}

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <CustomerAuthProvider>
      <CartProvider>
        <div className="min-h-screen bg-paper-50">
          <StoreHeader />
          {children}
        </div>
      </CartProvider>
    </CustomerAuthProvider>
  )
}
