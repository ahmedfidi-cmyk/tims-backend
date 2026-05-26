'use client';

import Link from 'next/link';
import { LahzaLogo } from '@/components/brand/Logo';
import { useCart } from '@/lib/cart/use-cart';

export function SiteHeader() {
  const { totalItems, hydrated } = useCart();

  return (
    <header className="border-b border-ink-900/10 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="LAHTHA الرئيسية">
          <LahzaLogo className="h-10 w-auto" />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-6 text-sm">
          <Link href="/devices" className="px-3 py-2 hover:text-ink-700">
            الأجهزة
          </Link>
          <Link
            href="/cart"
            className="relative flex items-center gap-2 rounded-md px-3 py-2 bg-paper-100 hover:bg-paper-50"
          >
            <span>السلة</span>
            {hydrated && totalItems > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium rounded-full bg-coral-500 text-white">
                {totalItems}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
