'use client'

import { useEffect, useState } from 'react'
import { AdminNav } from '@/components/AdminNav'
import { KycRequest } from '@/lib/mock/admin-data'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function KycApprovalsPage() {
  const [requests, setRequests] = useState<KycRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/kyc')
      const data = await res.json()
      setRequests(data.items || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  const handleDecision = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingId(id)
    try {
      await fetch('/api/admin/kyc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await fetchRequests()
    } finally {
      setProcessingId(null)
    }
  }

  const pending = requests.filter(r => r.status === 'pending')
  const processed = requests.filter(r => r.status !== 'pending')

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <AdminNav />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-ink-900 mb-2">طلبات التحقق (KYC)</h2>
          <p className="text-ink-900/60">{pending.length} طلب قيد المراجعة</p>
        </div>

        {loading ? (
          <p className="text-center py-12 text-ink-900/60">جاري التحميل...</p>
        ) : (
          <>
            {pending.length === 0 ? (
              <div className="card text-center py-12">
                <div className="text-5xl mb-4">✅</div>
                <p className="text-ink-900">جميع الطلبات تمت مراجعتها</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pending.map(req => (
                  <div key={req.id} className="card">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-ink-900">{req.vendor_name}</h3>
                        <p className="text-sm text-ink-900/60">قُدّم في {formatDate(req.submitted_at)}</p>
                      </div>
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                        قيد المراجعة
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-ink-900 mb-2">المستندات المرفوعة</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <span>{req.documents.id_card ? '✅' : '❌'}</span>
                            <span className="text-ink-900/70">صورة الهوية</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>{req.documents.cr_certificate ? '✅' : '❌'}</span>
                            <span className="text-ink-900/70">السجل التجاري</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>{req.documents.selfie ? '✅' : '❌'}</span>
                            <span className="text-ink-900/70">سيلفي مع الهوية</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink-900 mb-2">الحساب البنكي</p>
                        <p className="text-xs font-mono text-ink-900/70 bg-ink-900/5 p-2 rounded">
                          {req.bank_iban}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDecision(req.id, 'approved')}
                        disabled={processingId === req.id}
                        className="btn-primary flex-1 bg-green-600 disabled:opacity-50"
                      >
                        ✓ موافقة
                      </button>
                      <button
                        onClick={() => handleDecision(req.id, 'rejected')}
                        disabled={processingId === req.id}
                        className="btn-secondary flex-1 border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        ✕ رفض
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {processed.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-ink-900 mb-4">الطلبات السابقة</h3>
                <div className="card">
                  <table className="w-full text-sm">
                    <tbody>
                      {processed.map(req => (
                        <tr key={req.id} className="border-b border-ink-900/5">
                          <td className="p-3 font-medium">{req.vendor_name}</td>
                          <td className="p-3 text-xs text-ink-900/60">{formatDate(req.submitted_at)}</td>
                          <td className="p-3 text-left">
                            <span className={`text-xs font-medium ${
                              req.status === 'approved' ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {req.status === 'approved' ? '✓ مقبول' : '✕ مرفوض'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
