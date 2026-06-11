'use client'

import { useEffect, useState, useCallback } from 'react'
import { AdminNav } from '@/components/AdminNav'

interface UserView {
  user: { userId: string; personId: string; principalType: string; status: string; createdAt: string }
  roles: string[]
  permissions: string[]
}
interface RoleDef { roleId: string; domain: string; description: string }

const STATUS_LABELS: Record<string, { ar: string; color: string }> = {
  pending_kyc: { ar: 'قيد التحقق', color: 'bg-yellow-100 text-yellow-800' },
  active: { ar: 'نشط', color: 'bg-green-100 text-green-800' },
  suspended: { ar: 'موقوف', color: 'bg-red-100 text-red-800' },
  revoked: { ar: 'ملغى', color: 'bg-gray-200 text-gray-700' },
}

const STATUS_ACTIONS: Record<string, Array<{ action: string; label: string }>> = {
  pending_kyc: [{ action: 'ACTIVATE', label: 'تفعيل' }, { action: 'REVOKE', label: 'إلغاء' }],
  active: [{ action: 'SUSPEND', label: 'إيقاف' }, { action: 'REVOKE', label: 'إلغاء' }],
  suspended: [{ action: 'REINSTATE', label: 'إعادة' }, { action: 'REVOKE', label: 'إلغاء' }],
  revoked: [],
}

export default function AdminRolesPage() {
  const [users, setUsers] = useState<UserView[]>([])
  const [roles, setRoles] = useState<RoleDef[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const q = typeFilter ? `?principalType=${typeFilter}` : ''
      const [u, r] = await Promise.all([
        fetch(`/api/admin/users${q}`).then((x) => x.json()),
        fetch('/api/admin/roles').then((x) => x.json()),
      ])
      setUsers(u.items || [])
      setRoles(r.items || [])
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => { fetchAll() }, [fetchAll])

  const act = async (fn: () => Promise<Response>, key: string) => {
    setBusy(key)
    try { await fn() } finally { setBusy(null); await fetchAll() }
  }

  const grant = (userId: string, roleId: string) =>
    act(() => fetch(`/api/admin/users/${userId}/roles`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId }),
    }), `${userId}:grant`)

  const revoke = (userId: string, roleId: string) =>
    act(() => fetch(`/api/admin/users/${userId}/roles`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId }),
    }), `${userId}:${roleId}`)

  const changeStatus = (userId: string, action: string) =>
    act(() => fetch(`/api/admin/users/${userId}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    }), `${userId}:${action}`)

  const grantableFor = (principalType: string, current: string[]) =>
    roles.filter((r) => r.roleId.startsWith(`${principalType}.`) && !current.includes(r.roleId))

  return (
    <div className="min-h-screen bg-lahtha-pattern-dark">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="card mb-6 flex items-center gap-3">
          <span className="text-sm text-ink-900/70">تصفية حسب النوع:</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-ink-900/20 rounded px-2 py-1">
            <option value="">الكل</option>
            <option value="customer">عميل</option>
            <option value="vendor">بائع</option>
            <option value="dealer">تاجر</option>
            <option value="admin">مدير</option>
          </select>
        </div>

        <div className="card overflow-x-auto">
          {loading ? (
            <p className="text-center py-12 text-ink-900/60">جاري التحميل...</p>
          ) : users.length === 0 ? (
            <p className="text-center py-12 text-ink-900/60">لا يوجد مستخدمون (أو لا تملك صلاحية الإدارة)</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-ink-900/5 border-b border-ink-900/10">
                <tr>
                  <th className="text-right p-3 font-semibold">النوع</th>
                  <th className="text-right p-3 font-semibold">المعرّف</th>
                  <th className="text-right p-3 font-semibold">الحالة</th>
                  <th className="text-right p-3 font-semibold">الأدوار</th>
                  <th className="text-right p-3 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map(({ user, roles: userRoles }) => (
                  <tr key={user.userId} className="border-b border-ink-900/5 align-top">
                    <td className="p-3 font-medium">{user.principalType}</td>
                    <td className="p-3 font-mono text-xs text-ink-900/60">{user.userId.slice(0, 8)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_LABELS[user.status]?.color ?? ''}`}>
                        {STATUS_LABELS[user.status]?.ar ?? user.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length === 0 && <span className="text-xs text-ink-900/40">—</span>}
                        {userRoles.map((r) => (
                          <span key={r} className="inline-flex items-center gap-1 bg-ink-900/5 rounded px-2 py-1 text-xs">
                            {r}
                            <button onClick={() => revoke(user.userId, r)} disabled={busy !== null}
                              className="text-red-600 hover:text-red-800" title="إزالة">×</button>
                          </span>
                        ))}
                      </div>
                      {grantableFor(user.principalType, userRoles).length > 0 && (
                        <select defaultValue="" disabled={busy !== null}
                          onChange={(e) => { if (e.target.value) grant(user.userId, e.target.value) }}
                          className="mt-2 text-xs border border-ink-900/20 rounded px-2 py-1">
                          <option value="">+ إضافة دور</option>
                          {grantableFor(user.principalType, userRoles).map((r) => (
                            <option key={r.roleId} value={r.roleId}>{r.roleId}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {(STATUS_ACTIONS[user.status] ?? []).map(({ action, label }) => (
                          <button key={action} onClick={() => changeStatus(user.userId, action)} disabled={busy !== null}
                            className="text-xs border border-ink-900/20 rounded px-2 py-1 hover:bg-ink-900/5">
                            {label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
