export default function Home() {
  return (
    <div className="min-h-screen bg-lahtha-pattern-dark text-white relative">
      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink-900/80 pointer-events-none" />

      <div className="relative">
        {/* Header */}
        <header className="py-8 px-4">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-widest">LAHTHA</h1>
              <p className="text-gold-500 text-xs tracking-[0.3em] mt-1">& CLICK</p>
            </div>
            <nav className="flex gap-4 text-sm">
              <a href="/devices" className="text-white/70 hover:text-white transition">المنتجات</a>
              <a href="/vendor/auth/login" className="text-white/70 hover:text-white transition">البائعون</a>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 py-20 text-center">
          <p className="text-gold-500 text-sm tracking-[0.3em] uppercase mb-4">
            سوق التكنولوجيا الموثوق
          </p>
          <h2 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            منصة تداول<br />
            <span className="text-gold-500">أجهزة أبل</span>
          </h2>
          <p className="text-xl text-white/60 mb-12 max-w-2xl mx-auto">
            بيع واشتر بثقة مع حماية كاملة وأسعار عادلة وعمولة 5% فقط
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/devices"
              className="px-8 py-4 bg-gold-500 text-ink-900 font-bold rounded-lg hover:bg-gold-500/90 transition tracking-wider"
            >
              🛍️ تصفح المنتجات
            </a>
            <a
              href="/vendor/auth/login"
              className="px-8 py-4 border-2 border-white/20 text-white font-bold rounded-lg hover:bg-white/5 transition tracking-wider"
            >
              📦 بوابة البائع
            </a>
          </div>
        </section>

        {/* Portal Cards */}
        <section className="max-w-6xl mx-auto px-4 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer */}
            <div className="bg-white/[0.03] backdrop-blur border border-white/10 rounded-2xl p-8 hover:bg-white/[0.05] transition group">
              <div className="text-5xl mb-4">🛍️</div>
              <h3 className="text-2xl font-bold mb-3">للمشترين</h3>
              <p className="text-white/60 mb-6 leading-relaxed">
                استكشف مجموعة واسعة من أجهزة أبل الأصلية المستخدمة بأسعار تنافسية
              </p>
              <ul className="space-y-2 text-sm text-white/70 mb-6">
                <li className="flex items-center gap-2"><span className="text-gold-500">✓</span> منتجات موثوقة مع ضمان</li>
                <li className="flex items-center gap-2"><span className="text-gold-500">✓</span> Tabby و Tamara للتقسيط</li>
                <li className="flex items-center gap-2"><span className="text-gold-500">✓</span> توصيل آمن وسريع</li>
                <li className="flex items-center gap-2"><span className="text-gold-500">✓</span> حماية كاملة للمشتري</li>
              </ul>
              <a
                href="/devices"
                className="inline-block w-full text-center py-3 bg-white text-ink-900 font-bold rounded-lg group-hover:bg-gold-500 transition"
              >
                ابدأ التسوق الآن ←
              </a>
            </div>

            {/* Vendor */}
            <div className="bg-white/[0.03] backdrop-blur border border-gold-500/30 rounded-2xl p-8 hover:bg-white/[0.05] transition group relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gold-500 text-ink-900 text-xs font-bold px-3 py-1 rounded-bl-lg">
                للبائعين
              </div>
              <div className="text-5xl mb-4">📦</div>
              <h3 className="text-2xl font-bold mb-3">للبائعين</h3>
              <p className="text-white/60 mb-6 leading-relaxed">
                أدرج منتجاتك وابدأ في البيع مباشرة. إدارة كاملة للمخزون والطلبات
              </p>
              <ul className="space-y-2 text-sm text-white/70 mb-6">
                <li className="flex items-center gap-2"><span className="text-gold-500">✓</span> لوحة تحكم سهلة الاستخدام</li>
                <li className="flex items-center gap-2"><span className="text-gold-500">✓</span> رفع المخزون بصيغة CSV</li>
                <li className="flex items-center gap-2"><span className="text-gold-500">✓</span> تتبع طلبات فوري</li>
                <li className="flex items-center gap-2"><span className="text-gold-500">✓</span> أرباح آمنة (عمولة 5% فقط)</li>
              </ul>
              <a
                href="/vendor/auth/login"
                className="inline-block w-full text-center py-3 bg-gold-500 text-ink-900 font-bold rounded-lg group-hover:bg-white transition"
              >
                دخول بوابة البائع ←
              </a>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-4 pb-20">
          <h3 className="text-3xl font-bold text-center mb-12">
            لماذا تختار <span className="text-gold-500">LAHTHA & CLICK</span>؟
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: '🔒', title: 'آمن 100%', desc: 'تحقق من جميع الأجهزة بواسطة الخبراء' },
              { icon: '💰', title: 'أسعار عادلة', desc: 'بدون تكاليف خفية' },
              { icon: '⚡', title: 'توصيل سريع', desc: 'تسليم في 1-2 أيام عمل' },
              { icon: '💳', title: 'دفع مرن', desc: 'Tabby و Tamara متوفران' },
            ].map((f, i) => (
              <div key={i} className="text-center p-6 rounded-xl border border-white/5 hover:border-gold-500/30 transition">
                <div className="text-4xl mb-3">{f.icon}</div>
                <h4 className="font-bold mb-2">{f.title}</h4>
                <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 py-8 text-center text-sm text-white/40">
          <p>© 2026 LAHTHA & CLICK. جميع الحقوق محفوظة.</p>
          <p className="mt-2">
            <a href="/admin/auth/login" className="hover:text-white/70 transition text-xs">
              دخول الإدارة
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
