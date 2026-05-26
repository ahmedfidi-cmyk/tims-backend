'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart/use-cart';
import { getDeviceById, type MockDevice } from '@/lib/mock/devices';
import { formatSar, commissionHalalat } from '@/lib/money';

type CartLine = { item: { deviceId: string; quantity: number }; device: MockDevice };

export default function CartPage() {
  const { items, hydrated, setQuantity, remove } = useCart();

  const lines: CartLine[] = items
    .map((i) => ({ item: i, device: getDeviceById(i.deviceId) }))
    .filter((l): l is CartLine => l.device !== undefined);

  const subtotal = lines.reduce(
    (sum, l) => sum + l.device.priceHalalat * l.item.quantity,
    0,
  );
  const commission = commissionHalalat(subtotal);
  const total = subtotal + commission;

  if (!hydrated) {
    return <div className="py-16 text-center text-ink-500">جارٍ التحميل...</div>;
  }

  if (lines.length === 0) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">سلتك فارغة</h1>
        <p className="mt-2 text-ink-500">اختر جهازاً لتبدأ.</p>
        <Link href="/devices" className="btn-primary mt-6 inline-flex">
          تصفح الأجهزة
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-4">
        <h1 className="text-3xl font-bold mb-6">السلة</h1>
        {lines.map(({ item, device }) => (
          <div key={item.deviceId} className="card p-6 flex gap-6">
            <div className="w-24 h-24 rounded-lg bg-paper-100 flex-shrink-0 flex items-center justify-center text-xs text-ink-500">
              صورة
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{device.modelAr}</h3>
              <p className="text-sm text-ink-500 mt-1">
                {device.storage} · {device.colorAr}
              </p>
              <p className="mt-3 font-bold price-sar">{formatSar(device.priceHalalat)}</p>
            </div>
            <div className="flex flex-col items-end justify-between">
              <button
                type="button"
                onClick={() => remove(item.deviceId)}
                className="text-sm text-ink-500 hover:text-coral-500"
              >
                حذف
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(item.deviceId, item.quantity - 1)}
                  className="w-8 h-8 rounded border border-ink-900/20 hover:bg-paper-100"
                  aria-label="نقص"
                >
                  −
                </button>
                <span className="w-8 text-center font-medium">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(item.deviceId, item.quantity + 1)}
                  className="w-8 h-8 rounded border border-ink-900/20 hover:bg-paper-100"
                  aria-label="زيادة"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <aside className="card p-6 h-fit lg:sticky lg:top-6">
        <h2 className="font-semibold text-lg mb-4">ملخص الطلب</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-500">المجموع الفرعي</dt>
            <dd className="price-sar">{formatSar(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">عمولة المنصة (5%)</dt>
            <dd className="price-sar">{formatSar(commission)}</dd>
          </div>
          <div className="border-t border-ink-900/10 pt-3 flex justify-between font-bold text-lg">
            <dt>الإجمالي</dt>
            <dd className="price-sar">{formatSar(total)}</dd>
          </div>
        </dl>
        <Link href="/checkout" className="btn-primary w-full mt-6 block text-center">
          إتمام الشراء
        </Link>
        <p className="mt-4 text-xs text-ink-500 text-center">
          شفافية كاملة — لا رسوم إضافية بعد ذلك.
        </p>
      </aside>
    </div>
  );
}
