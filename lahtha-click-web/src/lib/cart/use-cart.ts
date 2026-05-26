'use client';

import { useEffect, useState, useCallback } from 'react';

export interface CartItem {
  deviceId: string;
  quantity: number;
}

const STORAGE_KEY = 'lahtha-cart-v1';

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is CartItem =>
        typeof i === 'object' && i !== null && 'deviceId' in i && 'quantity' in i,
    );
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('cart-changed'));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readCart());
    setHydrated(true);
    const handler = () => setItems(readCart());
    window.addEventListener('cart-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('cart-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const add = useCallback((deviceId: string) => {
    const current = readCart();
    const existing = current.find((i) => i.deviceId === deviceId);
    const next = existing
      ? current.map((i) => (i.deviceId === deviceId ? { ...i, quantity: i.quantity + 1 } : i))
      : [...current, { deviceId, quantity: 1 }];
    writeCart(next);
  }, []);

  const remove = useCallback((deviceId: string) => {
    writeCart(readCart().filter((i) => i.deviceId !== deviceId));
  }, []);

  const setQuantity = useCallback((deviceId: string, quantity: number) => {
    if (quantity <= 0) {
      writeCart(readCart().filter((i) => i.deviceId !== deviceId));
      return;
    }
    writeCart(readCart().map((i) => (i.deviceId === deviceId ? { ...i, quantity } : i)));
  }, []);

  const clear = useCallback(() => {
    writeCart([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, hydrated, totalItems, add, remove, setQuantity, clear };
}
