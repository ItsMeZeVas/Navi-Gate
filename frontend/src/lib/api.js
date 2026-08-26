// Helper centralizado para llamar al backend.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null

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
  listarQrs: (token) => request('/api/qr', { token }),
  crearQr: (nombre, token) => request('/api/qr', { method: 'POST', body: { nombre }, token }),
  actualizarQr: (id, nombre, token) =>
    request(`/api/qr/${id}`, { method: 'PATCH', body: { nombre }, token }),
  eliminarQr: (id, token) => request(`/api/qr/${id}`, { method: 'DELETE', token }),

  buscarEspacios: (params) => {
    const query = new URLSearchParams(params).toString()
    return request(`/api/espacios?${query}`)
  },
  crearEspacio: (datos, token) =>
    request('/api/espacios', { method: 'POST', body: datos, token }),
  actualizarEspacio: (id, datos, token) =>
    request(`/api/espacios/${id}`, { method: 'PATCH', body: datos, token }),
  eliminarEspacio: (id, token) =>
    request(`/api/espacios/${id}`, { method: 'DELETE', token }),

  listarBloques: (token) => request('/api/bloques', { token }),
  crearBloque: (nombre, token) =>
    request('/api/bloques', { method: 'POST', body: { nombre }, token }),
  actualizarBloque: (id, nombre, token) =>
    request(`/api/bloques/${id}`, { method: 'PATCH', body: { nombre }, token }),
  eliminarBloque: (id, token) => request(`/api/bloques/${id}`, { method: 'DELETE', token }),

  listarRutas: (token) => request('/api/rutas', { token }),
  crearRuta: (datos, token) => request('/api/rutas', { method: 'POST', body: datos, token }),
  actualizarRuta: (id, instrucciones, token) =>
    request(`/api/rutas/${id}`, { method: 'PATCH', body: { instrucciones }, token }),
  eliminarRuta: (id, token) => request(`/api/rutas/${id}`, { method: 'DELETE', token }),
}
