import { defineStore } from 'pinia'
import { ref } from 'vue'

// Guarda el QR de origen durante la sesión de navegación, para que
// las pestañas (Buscar, Explorar, Categorías) no lo pierdan al cambiar.
export const useSessionStore = defineStore('session', () => {
  const qrSlug = ref(sessionStorage.getItem('navigate_qr_slug') || '')
  const qrNombre = ref(sessionStorage.getItem('navigate_qr_nombre') || '')

  function setQr(slug, nombre) {
    qrSlug.value = slug
    qrNombre.value = nombre
    sessionStorage.setItem('navigate_qr_slug', slug)
    sessionStorage.setItem('navigate_qr_nombre', nombre)
  }

  return { qrSlug, qrNombre, setQr }
})
