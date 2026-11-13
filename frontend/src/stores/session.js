import { defineStore } from 'pinia'
import { ref } from 'vue'

// Guarda el QR de origen durante la sesión de navegación, para que
// las pestañas (Buscar, Explorar, Categorías) no lo pierdan al cambiar.
export const useSessionStore = defineStore('session', () => {
  const qrSlug = ref(sessionStorage.getItem('navigate_qr_slug') || '')
  const qrNombre = ref(sessionStorage.getItem('navigate_qr_nombre') || '')
  const qrNodoGrafoId = ref(sessionStorage.getItem('navigate_qr_nodo_grafo_id') || '')

  function setQr(slug, nombre, nodoGrafoId = null) {
    qrSlug.value = slug
    qrNombre.value = nombre
    qrNodoGrafoId.value = nodoGrafoId == null ? '' : String(nodoGrafoId)
    sessionStorage.setItem('navigate_qr_slug', slug)
    sessionStorage.setItem('navigate_qr_nombre', nombre)
    if (qrNodoGrafoId.value) sessionStorage.setItem('navigate_qr_nodo_grafo_id', qrNodoGrafoId.value)
    else sessionStorage.removeItem('navigate_qr_nodo_grafo_id')
  }

  return { qrSlug, qrNombre, qrNodoGrafoId, setQr }
})
