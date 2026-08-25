<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'

const usuario = ref('')
const password = ref('')
const error = ref('')
const cargando = ref(false)

const auth = useAuthStore()
const router = useRouter()

async function enviar() {
  error.value = ''
  cargando.value = true
  try {
    const { token } = await api.login(usuario.value, password.value)
    auth.setToken(token)
    router.push('/admin')
  } catch (err) {
    error.value = err.message
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="pagina">
    <form class="tarjeta" @submit.prevent="enviar">
      <span class="marca">NAVI-GATE</span>
      <h1>Panel de administración</h1>

      <label for="usuario">Usuario</label>
      <input id="usuario" v-model="usuario" type="text" autocomplete="username" required />

      <label for="password">Contraseña</label>
      <input
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        required
      />

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="cargando">
        {{ cargando ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.pagina {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ng-navy);
  padding: 1.5rem;
}

.tarjeta {
  width: 100%;
  max-width: 340px;
  background: var(--ng-cream);
  border-radius: 10px;
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.marca {
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--ng-navy);
  font-size: 1rem;
}

h1 {
  font-size: 1.4rem;
  margin-bottom: 1rem;
}

label {
  font-size: 0.85rem;
  color: var(--ng-ink-soft);
  margin-top: 0.6rem;
}

input {
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 1rem;
  background: white;
}

input:focus {
  outline: 3px solid var(--ng-amber);
  outline-offset: 1px;
  border-color: var(--ng-navy);
}

.error {
  color: var(--ng-danger);
  font-size: 0.85rem;
  margin-top: 0.6rem;
}

button {
  margin-top: 1.25rem;
  padding: 0.75rem;
  background: var(--ng-navy);
  color: var(--ng-amber);
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
