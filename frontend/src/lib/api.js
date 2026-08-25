// Helper centralizado para llamar al backend.
// En desarrollo, el backend corre en localhost:3000 (ver docker-compose.yml).
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.error || 'Ocurrió un error inesperado.')
  }

  return data
}

export const api = {
  login: (usuario, password) =>
    request('/api/admin/login', { method: 'POST', body: { usuario, password } }),

  getQr: (slug) => request(`/api/qr/${slug}`),

  buscarEspacios: (params) => {
    const query = new URLSearchParams(params).toString()
    return request(`/api/espacios?${query}`)
  },

  renombrarEspacio: (id, nombre, token) =>
    request(`/api/espacios/${id}`, { method: 'PATCH', body: { nombre }, token }),
}
