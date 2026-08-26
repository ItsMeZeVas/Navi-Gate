<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { api } from '../../lib/api'

const auth = useAuthStore()
const bloques = ref([])
const cargando = ref(true)
const error = ref('')

const nombreNuevo = ref('')
const creando = ref(false)

const editandoId = ref(null)
const nombreEdicion = ref('')

async function cargar() {
  cargando.value = true
  try {
    bloques.value = await api.listarBloques(auth.token)
  } catch (err) {
    error.value = err.message
  } finally {
    cargando.value = false
  }
}

async function crear() {
  if (!nombreNuevo.value.trim()) return
  creando.value = true
  error.value = ''
  try {
    await api.crearBloque(nombreNuevo.value.trim(), auth.token)
    nombreNuevo.value = ''
    await cargar()
  } catch (err) {
    error.value = err.message
  } finally {
    creando.value = false
  }
}

function empezarEdicion(bloque) {
  editandoId.value = bloque.id
  nombreEdicion.value = bloque.nombre
}

async function guardarEdicion(bloque) {
  if (!nombreEdicion.value.trim()) return
  try {
    await api.actualizarBloque(bloque.id, nombreEdicion.value.trim(), auth.token)
    editandoId.value = null
    await cargar()
  } catch (err) {
    error.value = err.message
  }
}

async function eliminar(bloque) {
  const confirmado = confirm(
    `¿Eliminar "${bloque.nombre}"? Esto también borrará sus ${bloque.espacios?.length || 0} espacio(s) y ${bloque.rutas?.length || 0} ruta(s) asociadas.`,
  )
  if (!confirmado) return
  try {
    await api.eliminarBloque(bloque.id, auth.token)
    await cargar()
  } catch (err) {
    error.value = err.message
  }
}

onMounted(cargar)
</script>

<template>
  <div>
    <form class="form-nuevo" @submit.prevent="crear">
      <input v-model="nombreNuevo" type="text" placeholder="Nombre del bloque nuevo, ej. Bloque D" />
      <button type="submit" :disabled="creando">Agregar</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="cargando" class="estado">Cargando bloques…</div>

    <ul v-else class="lista">
      <li v-for="bloque in bloques" :key="bloque.id" class="fila">
        <div v-if="editandoId === bloque.id" class="edicion">
          <input v-model="nombreEdicion" type="text" @keyup.enter="guardarEdicion(bloque)" />
          <button class="btn-guardar" @click="guardarEdicion(bloque)">Guardar</button>
          <button class="btn-cancelar" @click="editandoId = null">Cancelar</button>
        </div>
        <template v-else>
          <div class="info">
            <span class="nombre">{{ bloque.nombre }}</span>
            <span class="detalle">
              {{ bloque.espacios?.length || 0 }} espacio(s) · {{ bloque.rutas?.length || 0 }} ruta(s)
            </span>
          </div>
          <div class="acciones">
            <button class="btn-editar" @click="empezarEdicion(bloque)">Editar</button>
            <button class="btn-eliminar" @click="eliminar(bloque)">Eliminar</button>
          </div>
        </template>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.form-nuevo {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.form-nuevo input {
  flex: 1;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.9rem;
}

.form-nuevo button {
  padding: 0.6rem 1.1rem;
  background: var(--ng-navy);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
}

.error {
  color: var(--ng-danger);
  margin-bottom: 1rem;
}

.estado {
  color: var(--ng-ink-soft);
}

.lista {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.fila {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  flex-wrap: wrap;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.nombre {
  font-weight: 600;
}

.detalle {
  font-size: 0.78rem;
  color: var(--ng-ink-soft);
}

.acciones {
  display: flex;
  gap: 0.4rem;
}

.btn-editar,
.btn-eliminar,
.btn-guardar,
.btn-cancelar {
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-editar {
  background: white;
  border: 1px solid var(--ng-navy);
  color: var(--ng-navy);
}

.btn-eliminar {
  background: white;
  border: 1px solid var(--ng-danger);
  color: var(--ng-danger);
}

.btn-guardar {
  background: var(--ng-navy);
  color: white;
  border: none;
}

.btn-cancelar {
  background: none;
  border: 1px solid var(--color-border);
}

.edicion {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
}

.edicion input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--ng-navy);
  border-radius: 6px;
}
</style>
