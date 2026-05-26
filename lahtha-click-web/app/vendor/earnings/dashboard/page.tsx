'use client'

import { useVendorAuth } from '@/lib/hooks/use-vendor-auth'
import Link from 'next/link'
import { mockEarnings, mockOrders } from '@/lib/mock/vendor-data'

function formatSar(halalat: number) {
  return (halalat / 100).toLocaleString('ar-SA', {
    style: 'currency',
    currency: 'SAR',
  })
}

export default function EarningsDashboardPage() {
  const { vendor, logout } = useVendorAuth()

  const totalOrders = mockOrders.length
  const settledOrders = mockOrders.filter(o => o.status === 'delivered').length
  const pendingOrders = mockOrders.filter(o => o.status !== 'delivered').length

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      {/* Header */}
      <header className="bg-ink-900 text-white p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">لوحة الأرباح</h1>
            <p className="text-ink-900/70 text-sm">{vendor?.businessName}</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-coral-500 rounded-lg hover:opacity-90"
          >
            تسجيل الخروج
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-ink-900/80 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex gap-4">
            <Link href="/vendor/dashboard" className="text-white/60 hover:text-white">
              لوحة التحكم
            </Link>
            <Link href="/vendor/orders/history" className="text-white/60 hover:text-white">
              الطلبات
            </Link>
            <Link href="/vendor/earnings/dashboard" className="text-gold-500 font-bold border-b-2 border-gold-500">
              الأرباح
            </Link>
            <Link href="/vendor/profile/settings" className="text-white/60 hover:text-white">
              الملف الشخصي
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card border-l-4 border-coral-500">
            <p className="text-ink-900/60 text-sm mb-2">الأرباح الكلية</p>
            <p className="text-3xl font-bold text-coral-500 mb-2">
              {formatSar(mockEarnings.total_commission)}
            </p>
            <p className="text-xs text-ink-900/50">منذ البداية</p>
          </div>

          <div className="card border-l-4 border-gold-500">
            <p className="text-ink-900/60 text-sm mb-2">قيد التسوية</p>
            <p className="text-3xl font-bold text-gold-500 mb-2">
              {formatSar(mockEarnings.pending)}
            </p>
            <p className="text-xs text-ink-900/50">{pendingOrders} طلبات</p>
          </div>

          <div className="card border-l-4 border-green-500">
            <p className="text-ink-900/60 text-sm mb-2">المسدد</p>
            <p className="text-3xl font-bold text-green-600 mb-2">
              {formatSar(mockEarnings.settled)}
            </p>
            <p className="text-xs text-ink-900/50">{settledOrders} طلبات</p>
          </div>

          <div className="card border-l-4 border-ink-900">
            <p className="text-ink-900/60 text-sm mb-2">متوسط العمولة</p>
            <p className="text-3xl font-bold text-ink-900 mb-2">
              {formatSar(
                mockOrders.length > 0
                  ? mockOrders.reduce((sum, o) => sum + o.commission, 0) / mockOrders.length
                  : 0
              )}
            </p>
            <p className="text-xs text-ink-900/50">لكل طلب</p>
          </div>
        </div>

        {/* Monthly Breakdown */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-ink-900 mb-6">الأرباح الشهرية</h2>
          <div className="space-y-4">
            {mockEarnings.monthly_breakdown.map((month) => (
              <div key={month.month} className="flex items-center justify-between">
                <p className="font-medium text-ink-900 w-24">{month.month}</p>
                <div className="flex-1 ml-4 h-8 bg-ink-900/10 rounded-lg relative overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-coral-500 to-gold-500 rounded-lg transition-all"
                    style={{
                      width: `${(month.amount / 25000) * 100}%`,
                    }}
                  />
                </div>
                <p className="price text-right w-40">
                  {formatSar(month.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Commission Info */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-ink-900 mb-4">معلومات العمولة</h2>
          <div className="bg-ink-900/5 p-4 rounded-lg">
            <p className="text-sm text-ink-900/70 mb-3">
              ✓ تُحسب العمولة على كل طلب مسلّم بنجاح<br/>
              ✓ النسبة الثابتة: <span className="font-bold">5%</span> من سعر البيع<br/>
              ✓ يتم تسوية الأرباح أسبوعياً (كل يوم جمعة)<br/>
              ✓ التحويل يتم مباشرة لحسابك البنكي
            </p>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <h2 className="text-xl font-bold text-ink-900 mb-4">أحدث العمليات</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-900/5 border-b border-ink-900/10">
                <tr>
                  <th className="text-right p-3 font-semibold text-ink-900">التاريخ</th>
                  <th className="text-right p-3 font-semibold text-ink-900">النوع</th>
                  <th className="text-right p-3 font-semibold text-ink-900">المبلغ</th>
                  <th className="text-right p-3 font-semibold text-ink-900">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {mockOrders.slice(0, 5).map((order, idx) => (
                  <tr key={idx} className="border-b border-ink-900/5 hover:bg-ink-900/2">
                    <td className="p-3 text-xs text-ink-900/60">
                      {new Date(order.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="p-3 font-medium text-ink-900">عمولة طلب</td>
                    <td className="p-3 price">+{formatSar(order.commission)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        order.status === 'delivered'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status === 'delivered' ? 'مسدد' : 'قيد الانتظار'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
