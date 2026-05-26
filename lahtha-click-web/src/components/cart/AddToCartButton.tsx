'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart/use-cart';

export function AddToCartButton({ deviceId }: { deviceId: string }) {
  const { add } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);

  const handleBuyNow = (): void => {
    add(deviceId);
    router.push('/checkout');
  };

  const handleAdd = (): void => {
    add(deviceId);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className="flex flex-wrap gap-3">
      <button onClick={handleBuyNow} className="btn-primary flex-1 min-w-[200px]">
        اشترِ الآن
      </button>
      <button onClick={handleAdd} className="btn-secondary flex-1 min-w-[200px]">
        {added ? '✓ تمت الإضافة' : 'أضف إلى السلة'}
      </button>
    </div>
  );
}
