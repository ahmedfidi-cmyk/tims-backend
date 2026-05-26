const USE_REAL_API = process.env.NEXT_PUBLIC_USE_REAL_API === 'true'
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = USE_REAL_API && API_BASE ? `${API_BASE}${path}` : path

  const token = typeof window !== 'undefined'
    ? localStorage.getItem('vendor_token') || localStorage.getItem('admin_token')
    : null

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }

  return res.json()
}

export const api = {
  vendor: {
    inventory: {
      list: () => apiFetch('/api/vendor/inventory'),
      add: (items: any[]) => apiFetch('/api/vendor/inventory', {
        method: 'POST', body: JSON.stringify({ items })
      }),
      remove: (imei: string) => apiFetch('/api/vendor/inventory', {
        method: 'DELETE', body: JSON.stringify({ imei })
      }),
    },
    devices: {
      list: () => apiFetch('/api/vendor/devices'),
      create: (data: any) => apiFetch('/api/vendor/devices', {
        method: 'POST', body: JSON.stringify(data)
      }),
      update: (id: string, updates: any) => apiFetch('/api/vendor/devices', {
        method: 'PATCH', body: JSON.stringify({ id, ...updates })
      }),
      remove: (id: string) => apiFetch('/api/vendor/devices', {
        method: 'DELETE', body: JSON.stringify({ id })
      }),
    },
  },
  admin: {
    vendors: { list: () => apiFetch('/api/admin/vendors') },
    kyc: {
      list: () => apiFetch('/api/admin/kyc'),
      decide: (id: string, status: 'approved' | 'rejected') =>
        apiFetch('/api/admin/kyc', {
          method: 'PATCH', body: JSON.stringify({ id, status })
        }),
    },
    analytics: () => apiFetch('/api/admin/analytics'),
  },
  public: {
    devices: () => apiFetch('/api/devices'),
  },
}
