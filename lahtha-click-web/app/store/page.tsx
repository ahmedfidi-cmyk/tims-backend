'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProductTour, { type TourStep } from '@/components/ProductTour'

const STORE_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="store-hero"]', title: 'أهلاً بك في لحظة', body: 'سوق أجهزة Apple الموثّق — كل جهاز يمر بفحص IMEI ومطابقة فاتورة قبل عرضه.' },
  { selector: '[data-tour="store-stats"]', title: 'أرقام حيّة', body: 'عدد الأجهزة المتاحة الآن، وأقل سعر معروض — تُحدَّث مباشرةً من المتجر.' },
  { selector: '[data-tour="store-filters"]', title: 'ابحث وفلتر', body: 'اكتب اسم الموديل، أو ضيّق النتائج بالحالة والسعر والترتيب.' },
  { selector: '[data-tour="store-grid"]', title: 'اختر جهازك', body: 'انقر أي بطاقة لعرض تفاصيل الجهاز وإضافته للسلة.' },
]

interface ListingView {
  listing: { listingId: string; priceHalalat: number; deviceId: string }
  device: { modelName: string; condition: string; imei: string } | null
}

function sar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })
}
const CONDITION: Record<string, string> = {
  new_sealed: 'جديد مغلق', open_box: 'صندوق مفتوح', refurbished: 'مجدّد', used: 'مستعمل',
}

export default function StorePage() {
  const [items, setItems] = useState<ListingView[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')
  const [condition, setCondition] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('newest')

  // Live front-page stats — a one-time unfiltered read, independent of the
  // user's search/filter state below, so the hero numbers don't jump around
  // as they type.
  const [heroCount, setHeroCount] = useState<number | null>(null)
  const [heroFromHalalat, setHeroFromHalalat] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/store/listings?limit=100&sort=price_asc')
      .then((r) => r.json())
      .then((d) => {
        setHeroCount(typeof d.total === 'number' ? d.total : 0)
        const cheapest = (d.items || [])[0]?.listing?.priceHalalat
        setHeroFromHalalat(typeof cheapest === 'number' ? cheapest : null)
      })
      .catch(() => { setHeroCount(0); setHeroFromHalalat(null) })
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      const qs = new URLSearchParams()
      if (q.trim()) qs.set('q', q.trim())
      if (condition) qs.set('condition', condition)
      if (minPrice && Number(minPrice) >= 0) qs.set('minPriceHalalat', String(Math.round(Number(minPrice) * 100)))
      if (maxPrice && Number(maxPrice) >= 0) qs.set('maxPriceHalalat', String(Math.round(Number(maxPrice) * 100)))
      if (sort !== 'newest') qs.set('sort', sort)

      setLoading(true)
      fetch(`/api/store/listings?${qs.toString()}`)
        .then((r) => r.json())
        .then((d) => { setItems(d.items || []); setTotal(d.total || 0) })
        .catch(() => { setItems([]); setTotal(0) })
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [q, condition, minPrice, maxPrice, sort])

  const hasFilters = q || condition || minPrice || maxPrice || sort !== 'newest'
  function reset() {
    setQ(''); setCondition(''); setMinPrice(''); setMaxPrice(''); setSort('newest')
  }

  const field = 'px-3 py-2 border border-ink-900/20 rounded-lg text-sm focus:outline-none focus:border-coral-500'

  return (
    <main>
      <ProductTour tourId="store" steps={STORE_TOUR_STEPS} />

      {/* Front page: dark hero + live stats + trust strip. */}
      <section className="bg-lahtha-ink text-white" data-tour="store-hero">
        <div className="max-w-6xl mx-auto px-4 py-14 md:py-20">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-gold-500 border border-gold-500/40 rounded-full px-3 py-1.5 mb-6">
            ✦ سوق أجهزة Apple الموثّق
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight max-w-2xl">
            كل جهاز هنا <span className="text-gold-500">موثّق ومضمون.</span>
          </h1>
          <p className="mt-5 text-white/80 max-w-xl leading-relaxed">
            نتحقّق من رقم الـ IMEI، ونطابق الفاتورة الأصلية، ونعتمد كل بائع قبل عرض جهازه —
            لتشتري بثقة كاملة، مع دفع آمن محفوظ في العهدة حتى تأكيد الاستلام.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <a href="#browse" className="btn-primary">تصفّح المتجر</a>
          </div>
          <div className="flex flex-wrap gap-8 mt-10" data-tour="store-stats">
            <div>
              <p className="text-2xl font-extrabold text-white">
                {heroCount === null ? '…' : heroCount.toLocaleString('ar-SA')}
              </p>
              <p className="text-xs text-white/60 mt-1">جهاز متاح الآن</p>
            </div>
            {heroFromHalalat !== null && (
              <div>
                <p className="text-2xl font-extrabold text-white">{sar(heroFromHalalat)}</p>
                <p className="text-xs text-white/60 mt-1">ابتداءً من</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Trust strip. */}
      <section className="bg-white border-b border-ink-900/10">
        <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { t: 'IMEI موثّق', d: 'نتحقق من كل جهاز مقابل قواعد المشغّلين.' },
            { t: 'فاتورة أصلية', d: 'مستند مورّد متحقَّق منه لكل عملية بيع.' },
            { t: 'بائع معتمد', d: 'لا يُعرض جهاز قبل مراجعة هوية البائع.' },
            { t: 'دفع آمن وعهدة', d: 'المبلغ محفوظ حتى تأكيد استلامك.' },
          ].map((item) => (
            <div key={item.t}>
              <p className="font-bold text-ink-900 text-sm">{item.t}</p>
              <p className="text-xs text-ink-900/60 mt-1 leading-relaxed">{item.d}</p>
            </div>
          ))}
        </div>
      </section>

      <div id="browse" className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-ink-900 mb-4">تصفّح الأجهزة</h2>

        <div className="card mb-6 space-y-3" data-tour="store-filters">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن موديل (مثال: iPhone 17)"
            className={`${field} w-full`}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select value={condition} onChange={(e) => setCondition(e.target.value)} className={field}>
              <option value="">كل الحالات</option>
              {Object.entries(CONDITION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              placeholder="أقل سعر (ر.س)"
              className={field}
            />
            <input
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              placeholder="أعلى سعر (ر.س)"
              className={field}
            />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={field}>
              <option value="newest">الأحدث</option>
              <option value="price_asc">السعر: الأقل أولاً</option>
              <option value="price_desc">السعر: الأعلى أولاً</option>
            </select>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs text-ink-900/60">{loading ? 'جاري البحث...' : `${total} نتيجة`}</p>
            {hasFilters && (
              <button onClick={reset} className="text-xs text-coral-500 hover:underline">مسح عوامل التصفية</button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-center py-12 text-ink-900/60">جاري التحميل...</p>
        ) : items.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-ink-900/60">{hasFilters ? 'لا توجد أجهزة تطابق بحثك' : 'لا توجد عروض متاحة حالياً'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="store-grid">
            {items.map(({ listing, device }) => (
              <Link key={listing.listingId} href={`/store/${listing.listingId}`} className="card hover:shadow-lg transition block">
                <div className="bg-ink-900/5 h-36 rounded-lg mb-3 flex items-center justify-center text-5xl">📱</div>
                <h3 className="font-bold text-ink-900">{device?.modelName ?? 'جهاز'}</h3>
                <p className="text-xs text-ink-900/60 mb-2">{device ? CONDITION[device.condition] ?? device.condition : ''}</p>
                <p className="price">{sar(listing.priceHalalat)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
