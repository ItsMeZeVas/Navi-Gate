<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { api } from '../../lib/api'

const auth = useAuthStore()
const espacios = ref([])
const bloques = ref([])
const cargando = ref(true)
const error = ref('')

const TIPOS = ['SALON', 'OFICINA', 'LABORATORIO', 'CAFETERIA', 'BANO', 'OTRO']

const vacio = () => ({ nombre: '', tipo: 'SALON', piso: 1, bloqueId: '', instruccionFinal: '' })
const nuevoEspacio = ref(vacio())
const creando = ref(false)

const editandoId = ref(null)
const edicion = ref(vacio())

async function cargar() {
  cargando.value = true
  try {
    const [data, bloquesData] = await Promise.all([
      api.buscarEspacios({}),
      api.listarBloques(auth.token),
    ])
    espacios.value = data.resultados
    bloques.value = bloquesData
  } catch (err) {
    error.value = err.message
  } finally {
    cargando.value = false
  }
}

async function crear() {
  const e = nuevoEspacio.value
  if (!e.nombre.trim() || !e.bloqueId || !e.instruccionFinal.trim()) return
  creando.value = true
  error.value = ''
  try {
    await api.crearEspacio(e, auth.token)
    nuevoEspacio.value = vacio()
    await cargar()
  } catch (err) {
    error.value = err.message
  } finally {
    creando.value = false
  }
}

function empezarEdicion(espacio) {
  editandoId.value = espacio.id
  edicion.value = {
    nombre: espacio.nombre,
    tipo: espacio.tipo,
    piso: espacio.piso,
    bloqueId: espacio.bloqueId,
    instruccionFinal: espacio.instruccionFinal,
  }
}

async function guardarEdicion(espacio) {
  try {
    await api.actualizarEspacio(espacio.id, edicion.value, auth.token)
    editandoId.value = null
    await cargar()
  } catch (err) {
    error.value = err.message
  }
}

async function eliminar(espacio) {
  const confirmado = confirm(`¿Eliminar "${espacio.nombre}"?`)
  if (!confirmado) return
  try {
    await api.eliminarEspacio(espacio.id, auth.token)
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
      <div class="fila-form">
        <input v-model="nuevoEspacio.nombre" type="text" placeholder="Nombre, ej. D105" />
        <select v-model="nuevoEspacio.tipo">
          <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
        </select>
        <input v-model.number="nuevoEspacio.piso" type="number" placeholder="Piso" />
      </div>
      <div class="fila-form">
        <select v-model="nuevoEspacio.bloqueId">
          <option value="" disabled>Bloque…</option>
          <option v-for="b in bloques" :key="b.id" :value="b.id">{{ b.nombre }}</option>
        </select>
        <input
          v-model="nuevoEspacio.instruccionFinal"
          type="text"
          placeholder="Instrucción final, ej. Primer piso, segunda puerta"
        />
      </div>
      <button type="submit" :disabled="creando">Agregar espacio</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="cargando" class="estado">Cargando espacios…</div>

    <ul v-else class="lista">
      <li v-for="espacio in espacios" :key="espacio.id" class="fila">
        <div v-if="editandoId === espacio.id" class="edicion">
          <div class="fila-form">
            <input v-model="edicion.nombre" type="text" />
            <select v-model="edicion.tipo">
              <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
            </select>
            <input v-model.number="edicion.piso" type="number" />
          </div>
          <div class="fila-form">
            <select v-model="edicion.bloqueId">
              <option v-for="b in bloques" :key="b.id" :value="b.id">{{ b.nombre }}</option>
            </select>
            <input v-model="edicion.instruccionFinal" type="text" />
          </div>
          <div class="botones-edicion">
            <button class="btn-guardar" @click="guardarEdicion(espacio)">Guardar</button>
            <button class="btn-cancelar" @click="editandoId = null">Cancelar</button>
          </div>
        </div>
        <template v-else>
          <div class="info">
            <span class="codigo">{{ espacio.nombre }}</span>
            <span class="detalle">
              {{ espacio.bloque.nombre }} · Piso {{ espacio.piso }} · {{ espacio.tipo }}
            </span>
          </div>
          <div class="acciones">
            <button class="btn-editar" @click="empezarEdicion(espacio)">Editar</button>
            <button class="btn-eliminar" @click="eliminar(espacio)">Eliminar</button>
          </div>
        </template>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.form-nuevo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  padding: 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.fila-form {
  display: flex;
  gap: 0.5rem;
}

.fila-form input,
.fila-form select {
  flex: 1;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.88rem;
  min-width: 0;
}

.form-nuevo > button {
  padding: 0.6rem 1.1rem;
  background: var(--ng-navy);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
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
  gap: 0.25rem;
}

.codigo {
  font-weight: 600;
  background: var(--ng-navy);
  color: white;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  width: fit-content;
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
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.botones-edicion {
  display: flex;
  gap: 0.4rem;
}
</style>
