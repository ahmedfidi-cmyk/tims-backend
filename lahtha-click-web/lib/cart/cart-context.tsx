'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export interface CartItem {
  listingId: string
  modelName: string
  priceHalalat: number
}

interface CartContextType {
  items: CartItem[]
  add: (item: CartItem) => void
  remove: (listingId: string) => void
  clear: () => void
  has: (listingId: string) => boolean
  totalHalalat: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)
const KEY = 'lahtha_cart'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [])

  const persist = (next: CartItem[]) => {
    setItems(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.listingId === item.listingId)) return prev
      const next = [...prev, item]
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const remove = useCallback((listingId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.listingId !== listingId)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const clear = useCallback(() => persist([]), [])
  const has = useCallback((listingId: string) => items.some((i) => i.listingId === listingId), [items])
  const totalHalalat = items.reduce((s, i) => s + i.priceHalalat, 0)

  return (
    <CartContext.Provider value={{ items, add, remove, clear, has, totalHalalat }}>{children}</CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
