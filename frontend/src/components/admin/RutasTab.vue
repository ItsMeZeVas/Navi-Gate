<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { api } from '../../lib/api'

const auth = useAuthStore()
const rutas = ref([])
const qrs = ref([])
const bloques = ref([])
const cargando = ref(true)
const error = ref('')

const nuevaRuta = ref({ qrId: '', bloqueId: '', instrucciones: '' })
const creando = ref(false)

const editandoId = ref(null)
const instruccionesEdicion = ref('')

async function cargar() {
  cargando.value = true
  try {
    const [rutasData, qrsData, bloquesData] = await Promise.all([
      api.listarRutas(auth.token),
      api.listarQrs(auth.token),
      api.listarBloques(auth.token),
    ])
    rutas.value = rutasData
    qrs.value = qrsData
    bloques.value = bloquesData
  } catch (err) {
    error.value = err.message
  } finally {
    cargando.value = false
  }
}

async function crear() {
  if (!nuevaRuta.value.qrId || !nuevaRuta.value.bloqueId || !nuevaRuta.value.instrucciones.trim()) return
  creando.value = true
  error.value = ''
  try {
    await api.crearRuta(nuevaRuta.value, auth.token)
    nuevaRuta.value = { qrId: '', bloqueId: '', instrucciones: '' }
    await cargar()
  } catch (err) {
    error.value = err.message
  } finally {
    creando.value = false
  }
}

function empezarEdicion(ruta) {
  editandoId.value = ruta.id
  instruccionesEdicion.value = ruta.instrucciones
}

async function guardarEdicion(ruta) {
  if (!instruccionesEdicion.value.trim()) return
  try {
    await api.actualizarRuta(ruta.id, instruccionesEdicion.value.trim(), auth.token)
    editandoId.value = null
    await cargar()
  } catch (err) {
    error.value = err.message
  }
}

async function eliminar(ruta) {
  const confirmado = confirm(`¿Eliminar la ruta "${ruta.qr.nombre} → ${ruta.bloque.nombre}"?`)
  if (!confirmado) return
  try {
    await api.eliminarRuta(ruta.id, auth.token)
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
      <select v-model="nuevaRuta.qrId" required>
        <option value="" disabled>QR de origen…</option>
        <option v-for="qr in qrs" :key="qr.id" :value="qr.id">{{ qr.nombre }}</option>
      </select>
      <select v-model="nuevaRuta.bloqueId" required>
        <option value="" disabled>Bloque de destino…</option>
        <option v-for="bloque in bloques" :key="bloque.id" :value="bloque.id">{{ bloque.nombre }}</option>
      </select>
      <textarea
        v-model="nuevaRuta.instrucciones"
        placeholder="Instrucciones, ej. Camina hacia el Bloque D, sube al primer piso"
        rows="2"
      ></textarea>
      <button type="submit" :disabled="creando">Agregar ruta</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="cargando" class="estado">Cargando rutas…</div>

    <ul v-else class="lista">
      <li v-for="ruta in rutas" :key="ruta.id" class="fila">
        <div v-if="editandoId === ruta.id" class="edicion">
          <textarea v-model="instruccionesEdicion" rows="2"></textarea>
          <div class="botones-edicion">
            <button class="btn-guardar" @click="guardarEdicion(ruta)">Guardar</button>
            <button class="btn-cancelar" @click="editandoId = null">Cancelar</button>
          </div>
        </div>
        <template v-else>
          <div class="info">
            <span class="origen-destino">{{ ruta.qr.nombre }} → {{ ruta.bloque.nombre }}</span>
            <span class="detalle">{{ ruta.instrucciones }}</span>
          </div>
          <div class="acciones">
            <button class="btn-editar" @click="empezarEdicion(ruta)">Editar</button>
            <button class="btn-eliminar" @click="eliminar(ruta)">Eliminar</button>
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

.form-nuevo select,
.form-nuevo textarea {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: inherit;
}

.form-nuevo button {
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
  align-items: flex-start;
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
  flex: 1;
  min-width: 200px;
}

.origen-destino {
  font-weight: 600;
  font-size: 0.9rem;
}

.detalle {
  font-size: 0.8rem;
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

.edicion textarea {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--ng-navy);
  border-radius: 6px;
  font-family: inherit;
}

.botones-edicion {
  display: flex;
  gap: 0.4rem;
}
</style>
