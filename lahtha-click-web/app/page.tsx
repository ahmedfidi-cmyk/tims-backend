export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-900 via-paper-50 to-paper-50">
      {/* Header */}
      <header className="bg-ink-900 text-white py-6 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-2">LAHTHA & CLICK</h1>
          <p className="text-gold-500 font-semibold">سوق التكنولوجيا الموثوق</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <section className="text-center mb-16">
          <h2 className="text-5xl font-bold text-ink-900 mb-4">
            منصتك الموثوقة لتداول أجهزة أبل
          </h2>
          <p className="text-xl text-ink-900/70 mb-8">
            بيع واشتر بثقة مع حماية كاملة وأسعار عادلة
          </p>
        </section>

        {/* Portal Selection */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Customer Portal */}
          <div className="card hover:shadow-lg transition-shadow border-2 border-coral-500">
            <div className="text-5xl mb-4">🛍️</div>
            <h3 className="text-3xl font-bold text-ink-900 mb-3">للمشترين</h3>
            <p className="text-ink-900/70 mb-6">
              استكشف مجموعة واسعة من أجهزة أبل الأصلية المستخدمة بأسعار تنافسية
            </p>
            <ul className="space-y-2 text-sm text-ink-900/70 mb-6">
              <li>✓ منتجات موثوقة مع ضمان</li>
              <li>✓ خيارات دفع مرنة (Tabby, Tamara)</li>
              <li>✓ توصيل آمن وسريع</li>
              <li>✓ حماية كاملة للمشتري</li>
            </ul>
            <a href="/devices" className="btn-primary w-full text-center">
              ابدأ التسوق الآن
            </a>
          </div>

          {/* Vendor Portal */}
          <div className="card hover:shadow-lg transition-shadow border-2 border-gold-500">
            <div className="text-5xl mb-4">📦</div>
            <h3 className="text-3xl font-bold text-ink-900 mb-3">للبائعين</h3>
            <p className="text-ink-900/70 mb-6">
              أدرج منتجاتك وابدأ في البيع مباشرة. إدارة كاملة للمخزون والطلبات
            </p>
            <ul className="space-y-2 text-sm text-ink-900/70 mb-6">
              <li>✓ لوحة تحكم سهلة الاستخدام</li>
              <li>✓ إدارة مخزون ذكية</li>
              <li>✓ تتبع طلبات فوري</li>
              <li>✓ أرباح آمنة (عمولة 5%)</li>
            </ul>
            <a href="/vendor/auth/login" className="btn-primary w-full text-center">
              دخول بوابة البائع
            </a>
          </div>
        </section>

        {/* Features */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-ink-900 mb-8 text-center">
            لماذا تختار LAHTHA & CLICK؟
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-4xl mb-3">🔒</div>
              <h4 className="font-bold text-ink-900 mb-2">آمن 100%</h4>
              <p className="text-sm text-ink-900/70">
                تحقق من جميع الأجهزة بواسطة الخبراء
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">💰</div>
              <h4 className="font-bold text-ink-900 mb-2">أسعار عادلة</h4>
              <p className="text-sm text-ink-900/70">
                بدون تكاليف خفية
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">⚡</div>
              <h4 className="font-bold text-ink-900 mb-2">توصيل سريع</h4>
              <p className="text-sm text-ink-900/70">
                تسليم في 1-2 أيام عمل
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">💳</div>
              <h4 className="font-bold text-ink-900 mb-2">دفع مرن</h4>
              <p className="text-sm text-ink-900/70">
                Tabby و Tamara متوفران
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-ink-900 text-white py-6 text-center">
        <p>© 2026 LAHTHA & CLICK. جميع الحقوق محفوظة.</p>
        <p className="text-xs text-white/40 mt-2">
          <a href="/admin/auth/login" className="hover:text-white/80">دخول الإدارة</a>
        </p>
      </footer>
    </div>
  );
}
