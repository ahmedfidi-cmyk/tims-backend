import Link from 'next/link';
import { MOCK_DEVICES } from '@/lib/mock/devices';
import { formatSar } from '@/lib/money';

export default function HomePage() {
  const featured = MOCK_DEVICES.slice(0, 3);

  return (
    <div className="space-y-16">
      <section className="rounded-xl bg-ink-900 px-8 py-16 sm:px-16 sm:py-24 text-white">
        <div className="max-w-2xl">
          <span className="inline-block px-3 py-1 rounded-full bg-gold-500/20 text-gold-100 text-xs font-medium">
            جديد · مختوم · بضمان رسمي
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl font-bold leading-tight">
            جهازك الجديد، في لحظة، بفاتورة موثقة.
          </h1>
          <p className="mt-6 text-lg text-white/80 leading-relaxed">
            متجر أجهزة Apple بضمان رسمي معتمد وفواتير ZATCA. ادفع بـ Tabby أو Tamara على دفعات بدون فوائد.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/devices" className="btn-gold">
              تصفح الأجهزة
            </Link>
            <Link
              href="#how"
              className="btn inline-flex bg-white/10 text-white border border-white/20 hover:bg-white/20"
            >
              كيف يعمل
            </Link>
          </div>
        </div>
      </section>

      <section id="how">
        <h2 className="text-3xl font-bold mb-8">كيف تشتري في 4 خطوات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { n: '1', t: 'اختر جهازك', d: 'تصفح المجموعة الجديدة، كل جهاز ببيانات IMEI كاملة.' },
            { n: '2', t: 'أضف إلى السلة', d: 'سعر شفاف، عمولة 5% تظهر صراحة، لا رسوم خفية.' },
            { n: '3', t: 'ادفع كما يناسبك', d: 'تقسيط Tabby أو Tamara بدون فوائد.' },
            { n: '4', t: 'استلم بفاتورة', d: 'فاتورة ZATCA رسمية تصلك على البريد، الجهاز بضمان سنة.' },
          ].map((step) => (
            <div key={step.n} className="card p-6">
              <div className="w-10 h-10 rounded-full bg-gold-500 text-ink-900 flex items-center justify-center font-bold text-lg">
                {step.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{step.t}</h3>
              <p className="mt-2 text-sm text-ink-500 leading-relaxed">{step.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-8">
          <h2 className="text-3xl font-bold">المختارة</h2>
          <Link href="/devices" className="text-sm text-ink-500 hover:text-ink-900">
            عرض الكل ←
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((d) => (
            <Link
              key={d.id}
              href={`/devices/${d.id}`}
              className="card p-6 hover:shadow-md transition-shadow"
            >
              <div className="aspect-square rounded-lg bg-paper-100 flex items-center justify-center mb-4">
                <span className="text-ink-500 text-sm">صورة الجهاز</span>
              </div>
              <h3 className="font-semibold">{d.modelAr}</h3>
              <p className="text-sm text-ink-500 mt-1">
                {d.storage} · {d.colorAr}
              </p>
              <p className="mt-4 text-xl font-bold price-sar">{formatSar(d.priceHalalat)}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
