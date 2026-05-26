'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cart/use-cart';
import { getDeviceById, type MockDevice } from '@/lib/mock/devices';
import { formatSar, commissionHalalat } from '@/lib/money';

type PaymentMethod = 'tabby' | 'tamara' | 'card';
type Line = { item: { deviceId: string; quantity: number }; device: MockDevice };

export default function CheckoutPage() {
  const { items, clear, hydrated } = useCart();
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>('tabby');
  const [submitting, setSubmitting] = useState(false);

  const lines: Line[] = items
    .map((i) => ({ item: i, device: getDeviceById(i.deviceId) }))
    .filter((l): l is Line => l.device !== undefined);

  const subtotal = lines.reduce((s, l) => s + l.device.priceHalalat * l.item.quantity, 0);
  const commission = commissionHalalat(subtotal);
  const total = subtotal + commission;

  if (!hydrated) return null;
  if (lines.length === 0) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">السلة فارغة</h1>
        <Link href="/devices" className="btn-primary mt-6 inline-flex">
          تصفح الأجهزة
        </Link>
      </div>
    );
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      clear();
      router.push('/checkout/success');
    }, 800);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
        <h1 className="text-3xl font-bold">إتمام الشراء</h1>

        <fieldset className="card p-6 space-y-4">
          <legend className="font-semibold text-lg mb-2">بيانات الاستلام</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium">الاسم الكامل</span>
              <input
                required
                type="text"
                className="mt-1 w-full rounded-md border border-ink-900/15 px-3 py-2 focus:outline-none focus:border-ink-900"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">رقم الجوال</span>
              <input
                required
                type="tel"
                placeholder="05XXXXXXXX"
                dir="ltr"
                className="mt-1 w-full rounded-md border border-ink-900/15 px-3 py-2 focus:outline-none focus:border-ink-900"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">البريد الإلكتروني</span>
              <input
                required
                type="email"
                dir="ltr"
                className="mt-1 w-full rounded-md border border-ink-900/15 px-3 py-2 focus:outline-none focus:border-ink-900"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">العنوان</span>
              <textarea
                required
                rows={2}
                className="mt-1 w-full rounded-md border border-ink-900/15 px-3 py-2 focus:outline-none focus:border-ink-900"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="card p-6">
          <legend className="font-semibold text-lg mb-4">طريقة الدفع</legend>
          <div className="space-y-3">
            <PaymentOption
              value="tabby"
              current={method}
              onSelect={setMethod}
              title="Tabby"
              subtitle="ادفع على 4 دفعات بدون فوائد"
              perMonth={Math.ceil(total / 4)}
            />
            <PaymentOption
              value="tamara"
              current={method}
              onSelect={setMethod}
              title="Tamara"
              subtitle="اشترِ الآن، ادفع لاحقاً (حتى 3 دفعات)"
              perMonth={Math.ceil(total / 3)}
            />
            <PaymentOption
              value="card"
              current={method}
              onSelect={setMethod}
              title="بطاقة ائتمان"
              subtitle="قريباً — متاح في المرحلة الثانية بعد اعتماد الأوراق"
              disabled
            />
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full disabled:opacity-60"
        >
          {submitting ? 'جارٍ التأكيد...' : `أكمل الدفع · ${formatSar(total)} ر.س`}
        </button>
        <p className="text-xs text-ink-500 text-center">
          بمتابعتك توافق على شروط الاستخدام وسياسة الخصوصية. ستصلك فاتورة ZATCA على البريد بعد الدفع.
        </p>
      </form>

      <aside className="card p-6 h-fit lg:sticky lg:top-6">
        <h2 className="font-semibold mb-4">طلبك</h2>
        <ul className="space-y-3 text-sm">
          {lines.map(({ item, device }) => (
            <li key={item.deviceId} className="flex justify-between gap-2">
              <span className="flex-1">
                {device.modelAr} <span className="text-ink-500">× {item.quantity}</span>
              </span>
              <span className="price-sar shrink-0">
                {formatSar(device.priceHalalat * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 pt-4 border-t border-ink-900/10 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-500">المجموع</dt>
            <dd className="price-sar">{formatSar(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">عمولة 5%</dt>
            <dd className="price-sar">{formatSar(commission)}</dd>
          </div>
          <div className="flex justify-between font-bold pt-2 border-t border-ink-900/10">
            <dt>الإجمالي</dt>
            <dd className="price-sar">{formatSar(total)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

interface PaymentOptionProps {
  value: PaymentMethod;
  current: PaymentMethod;
  onSelect: (v: PaymentMethod) => void;
  title: string;
  subtitle: string;
  perMonth?: number;
  disabled?: boolean;
}

function PaymentOption({
  value,
  current,
  onSelect,
  title,
  subtitle,
  perMonth,
  disabled,
}: PaymentOptionProps) {
  const selected = current === value;
  const stateClasses = selected
    ? 'border-ink-900 bg-paper-100'
    : 'border-ink-900/10 hover:border-ink-900/30';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';
  return (
    <label className={`block p-4 rounded-lg border transition-colors ${stateClasses} ${disabledClasses}`}>
      <div className="flex items-start gap-3">
        <input
          type="radio"
          name="payment-method"
          value={value}
          checked={selected}
          onChange={() => !disabled && onSelect(value)}
          disabled={disabled}
          className="mt-1 accent-ink-900"
        />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{title}</span>
            {perMonth !== undefined && (
              <span className="text-sm text-ink-500">
                <span className="price-sar">{formatSar(perMonth)}</span> / شهر
              </span>
            )}
          </div>
          <p className="text-xs text-ink-500 mt-1">{subtitle}</p>
        </div>
      </div>
    </label>
  );
}
