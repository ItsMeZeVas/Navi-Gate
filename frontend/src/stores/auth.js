import { defineStore } from 'pinia'
import { ref } from 'vue'

// Guarda el JWT del admin. Se persiste en localStorage para que la
// sesión sobreviva a un refresh de página.
export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('navigate_admin_token') || '')

  function setToken(nuevoToken) {
    token.value = nuevoToken
    localStorage.setItem('navigate_admin_token', nuevoToken)
  }

  function logout() {
    token.value = ''
    localStorage.removeItem('navigate_admin_token')
  }

  return { token, setToken, logout }
})
