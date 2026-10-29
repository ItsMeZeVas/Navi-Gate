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
  actualizarRuta: (id, instrucciones, fotos, token) =>
    request(`/api/rutas/${id}`, { method: 'PATCH', body: { instrucciones, fotos }, token }),
  eliminarRuta: (id, token) => request(`/api/rutas/${id}`, { method: 'DELETE', token }),

  // Grafo de mapeo (opción alternativa a crear rutas a mano).
  obtenerGrafo: (token) => request('/api/grafo', { token }),
  crearNodoGrafo: (datos, token) => request('/api/grafo/nodos', { method: 'POST', body: datos, token }),
  actualizarNodoGrafo: (id, datos, token) =>
    request(`/api/grafo/nodos/${id}`, { method: 'PATCH', body: datos, token }),
  eliminarNodoGrafo: (id, token) => request(`/api/grafo/nodos/${id}`, { method: 'DELETE', token }),
  crearEdgeGrafo: (origenId, destinoId, token) =>
    request('/api/grafo/edges', { method: 'POST', body: { origenId, destinoId }, token }),
  eliminarEdgeGrafo: (id, token) => request(`/api/grafo/edges/${id}`, { method: 'DELETE', token }),
  generarRutaDesdeGrafo: (datos, token) =>
    request('/api/grafo/generar-ruta', { method: 'POST', body: datos, token }),

  // Generación masiva de rutas desde el grafo (previsualizar no escribe; aplicar sí).
  previsualizarRutasMasivas: (datos, token) =>
    request('/api/grafo/rutas-masivas/previsualizar', { method: 'POST', body: datos, token }),
  aplicarRutasMasivas: (datos, token) =>
    request('/api/grafo/rutas-masivas/aplicar', { method: 'POST', body: datos, token }),

  // Crear varios espacios de una vez (rango de números en un bloque y piso).
  crearEspaciosLote: (datos, token) =>
    request('/api/espacios/lote', { method: 'POST', body: datos, token }),

  // Puntos del grafo visibles en la app pública (puntos de referencia, ascensores…).
  buscarPuntos: (params) => {
    const query = new URLSearchParams(params).toString()
    return request(`/api/puntos?${query}`)
  },

  // Estadísticas de escaneos (dashboard del panel admin).
  obtenerResumenEscaneos: (token) => request('/api/escaneos/resumen', { token }),

  // Eventos (panel admin + burbuja de la pantalla de Inicio).
  getEventosVigentes: (qrSlug) => request(`/api/eventos/vigentes?qr=${encodeURIComponent(qrSlug || '')}`),
  listarEventos: (token) => request('/api/eventos', { token }),
  crearEvento: (datos, token) => request('/api/eventos', { method: 'POST', body: datos, token }),
  actualizarEvento: (id, datos, token) =>
    request(`/api/eventos/${id}`, { method: 'PATCH', body: datos, token }),
  eliminarEvento: (id, token) => request(`/api/eventos/${id}`, { method: 'DELETE', token }),
  crearSubEvento: (eventoId, datos, token) =>
    request(`/api/eventos/${eventoId}/sub-eventos`, { method: 'POST', body: datos, token }),
  actualizarSubEvento: (id, datos, token) =>
    request(`/api/eventos/sub-eventos/${id}`, { method: 'PATCH', body: datos, token }),
  eliminarSubEvento: (id, token) =>
    request(`/api/eventos/sub-eventos/${id}`, { method: 'DELETE', token }),

  // Sube un archivo de imagen y devuelve su URL completa y accesible.
  subirFoto: async (archivo, token) => {
    const formData = new FormData()
    formData.append('foto', archivo)

    const res = await fetch(`${BASE_URL}/api/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'No se pudo subir la imagen.')

    // Cloudinary devuelve una URL absoluta (https://...); el modo disco local,
    // una ruta relativa (/uploads/...) que hay que completar con la del backend.
    return /^https?:\/\//.test(data.url) ? data.url : `${BASE_URL}${data.url}`
  },
}
