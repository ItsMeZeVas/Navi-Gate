<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'

const auth = useAuthStore()
const router = useRouter()

const espacios = ref([])
const cargando = ref(true)
const error = ref('')

const editandoId = ref(null)
const nombreEdicion = ref('')
const guardando = ref(false)

async function cargar() {
  cargando.value = true
  try {
    const data = await api.buscarEspacios({})
    espacios.value = data.resultados
  } catch (err) {
    error.value = err.message
  } finally {
    cargando.value = false
  }
}

function empezarEdicion(espacio) {
  editandoId.value = espacio.id
  nombreEdicion.value = espacio.nombre
}

function cancelarEdicion() {
  editandoId.value = null
  nombreEdicion.value = ''
}

async function guardarNombre(espacio) {
  if (!nombreEdicion.value.trim()) return
  guardando.value = true
  try {
    await api.renombrarEspacio(espacio.id, nombreEdicion.value.trim(), auth.token)
    espacio.nombre = nombreEdicion.value.trim()
    cancelarEdicion()
  } catch (err) {
    error.value = err.message
  } finally {
    guardando.value = false
  }
}

function salir() {
  auth.logout()
  router.push('/admin/login')
}

onMounted(cargar)
</script>

<template>
  <div class="pagina">
    <header class="encabezado">
      <span class="marca">NAVI-GATE · Admin</span>
      <button class="salir" @click="salir">Salir</button>
    </header>

    <main class="contenido">
      <h1>Espacios</h1>
      <p class="ayuda">Solo puedes cambiar el nombre. La ruta y el bloque no se ven afectados.</p>

      <p v-if="error" class="error">{{ error }}</p>
      <div v-if="cargando" class="estado">Cargando espacios…</div>

      <ul v-else class="lista">
        <li v-for="espacio in espacios" :key="espacio.id" class="fila">
          <div class="info">
            <span class="codigo">{{ espacio.nombre }}</span>
            <span class="detalle">{{ espacio.bloque.nombre }} · Piso {{ espacio.piso }} · {{ espacio.tipo }}</span>
          </div>

          <div v-if="editandoId === espacio.id" class="edicion">
            <input v-model="nombreEdicion" type="text" @keyup.enter="guardarNombre(espacio)" />
            <button class="btn-guardar" :disabled="guardando" @click="guardarNombre(espacio)">
              Guardar
            </button>
            <button class="btn-cancelar" @click="cancelarEdicion">Cancelar</button>
          </div>
          <button v-else class="btn-editar" @click="empezarEdicion(espacio)">Renombrar</button>
        </li>
      </ul>
    </main>
  </div>
</template>

<style scoped>
.pagina {
  min-height: 100vh;
}

.encabezado {
  background: var(--ng-navy);
  color: var(--ng-cream);
  padding: 1.1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.marca {
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0.05em;
}

.salir {
  background: none;
  border: 1px solid rgba(245, 243, 237, 0.4);
  color: var(--ng-cream);
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.contenido {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1.5rem 3rem;
}

.ayuda {
  color: var(--ng-ink-soft);
  margin-top: 0.3rem;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.error {
  color: var(--ng-danger);
  margin-bottom: 1rem;
}

.lista {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.fila {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  flex-wrap: wrap;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.codigo {
  font-family: var(--font-mono);
  font-weight: 500;
  background: var(--ng-navy);
  color: var(--ng-amber);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
  width: fit-content;
}

.detalle {
  font-size: 0.8rem;
  color: var(--ng-ink-soft);
}

.btn-editar {
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--ng-navy);
  background: white;
  color: var(--ng-navy);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-editar:hover {
  background: var(--ng-navy);
  color: white;
}

.edicion {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.edicion input {
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--ng-navy);
  border-radius: 6px;
  font-size: 0.9rem;
}

.btn-guardar {
  padding: 0.45rem 0.8rem;
  background: var(--ng-navy);
  color: var(--ng-amber);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-cancelar {
  padding: 0.45rem 0.8rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.estado {
  color: var(--ng-ink-soft);
  padding: 1rem 0;
}
</style>
