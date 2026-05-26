import Link from 'next/link';
import { MOCK_DEVICES } from '@/lib/mock/devices';
import { formatSar } from '@/lib/money';

export default function DevicesPage() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold">الأجهزة المتوفرة</h1>
        <p className="mt-2 text-ink-500">
          جميع الأجهزة جديدة، مختومة، مع ضمان رسمي ومسجلة عبر IMEI.
        </p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_DEVICES.map((d) => (
          <Link
            key={d.id}
            href={`/devices/${d.id}`}
            className="card p-6 hover:shadow-md transition-shadow"
          >
            <div className="aspect-square rounded-lg bg-paper-100 flex items-center justify-center mb-4">
              <span className="text-ink-500 text-sm">صورة {d.modelAr}</span>
            </div>
            <h3 className="font-semibold text-lg">{d.modelAr}</h3>
            <p className="text-sm text-ink-500 mt-1">
              {d.storage} · {d.colorAr}
            </p>
            <div className="mt-4 flex items-end justify-between">
              <p className="text-xl font-bold price-sar">{formatSar(d.priceHalalat)}</p>
              <span className="text-xs text-ink-500">ضمان {d.warrantyMonths} شهر</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
