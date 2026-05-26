import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MOCK_DEVICES, getDeviceById } from '@/lib/mock/devices';
import { formatSar } from '@/lib/money';
import { AddToCartButton } from '@/components/cart/AddToCartButton';

export function generateStaticParams() {
  return MOCK_DEVICES.map((d) => ({ id: d.id }));
}

export default function DeviceDetailPage({ params }: { params: { id: string } }) {
  const device = getDeviceById(params.id);
  if (!device) notFound();

  const tabbyPerMonth = Math.ceil(device.priceHalalat / 4);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
      <div className="aspect-square rounded-xl bg-paper-100 flex items-center justify-center">
        <span className="text-ink-500">صورة الجهاز</span>
      </div>

      <div>
        <Link href="/devices" className="text-sm text-ink-500 hover:text-ink-900">
          → كل الأجهزة
        </Link>
        <h1 className="mt-4 text-3xl font-bold">{device.modelAr}</h1>
        <p className="mt-2 text-ink-500">
          {device.storage} · {device.colorAr}
        </p>

        <div className="mt-6">
          <p className="text-4xl font-bold price-sar">{formatSar(device.priceHalalat)}</p>
          <p className="mt-2 text-sm text-ink-500">
            السعر يشمل ضريبة القيمة المضافة. تظهر عمولة 5% عند الدفع بشكل صريح.
          </p>
        </div>

        <div className="mt-6 p-4 rounded-lg bg-coral-100/40 border border-coral-500/30">
          <p className="text-sm font-medium">📦 ادفع على 4 دفعات بدون فوائد</p>
          <p className="text-xs text-ink-500 mt-1">
            عبر Tabby أو Tamara — من{' '}
            <span className="font-medium text-ink-900 price-sar">{formatSar(tabbyPerMonth)}</span>{' '}
            شهرياً
          </p>
        </div>

        <div className="mt-8">
          <AddToCartButton deviceId={device.id} />
        </div>

        <div className="mt-12">
          <h2 className="text-lg font-semibold mb-3">المميزات</h2>
          <ul className="space-y-2 text-sm">
            {device.highlightsAr.map((h) => (
              <li key={h} className="flex items-start gap-2">
                <span className="text-gold-500 mt-1">●</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 p-4 rounded-lg bg-paper-100">
          <h3 className="font-medium text-sm">ما تحصل عليه</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-700">
            <li>✓ جهاز جديد مختوم من Apple</li>
            <li>✓ فاتورة ZATCA رسمية</li>
            <li>✓ ضمان شركة Apple {device.warrantyMonths} شهر</li>
            <li>✓ تسجيل IMEI كامل في النظام</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
