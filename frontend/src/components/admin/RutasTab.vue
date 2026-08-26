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

const nuevaRuta = ref({ qrId: '', bloqueId: '', pasos: [''] })
const creando = ref(false)

const editandoId = ref(null)
const pasosEdicion = ref([''])

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

function agregarPaso(lista) {
  lista.push('')
}

function quitarPaso(lista, indice) {
  if (lista.length > 1) lista.splice(indice, 1)
}

async function crear() {
  const pasosLimpios = nuevaRuta.value.pasos.map((p) => p.trim()).filter(Boolean)
  if (!nuevaRuta.value.qrId || !nuevaRuta.value.bloqueId || pasosLimpios.length === 0) return
  creando.value = true
  error.value = ''
  try {
    await api.crearRuta(
      { qrId: nuevaRuta.value.qrId, bloqueId: nuevaRuta.value.bloqueId, instrucciones: pasosLimpios },
      auth.token,
    )
    nuevaRuta.value = { qrId: '', bloqueId: '', pasos: [''] }
    await cargar()
  } catch (err) {
    error.value = err.message
  } finally {
    creando.value = false
  }
}

function empezarEdicion(ruta) {
  editandoId.value = ruta.id
  pasosEdicion.value = [...ruta.instrucciones]
}

async function guardarEdicion(ruta) {
  const pasosLimpios = pasosEdicion.value.map((p) => p.trim()).filter(Boolean)
  if (pasosLimpios.length === 0) return
  try {
    await api.actualizarRuta(ruta.id, pasosLimpios, auth.token)
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

      <div class="pasos-form">
        <div v-for="(paso, i) in nuevaRuta.pasos" :key="i" class="fila-paso">
          <span class="numero-paso">{{ i + 1 }}</span>
          <input v-model="nuevaRuta.pasos[i]" type="text" :placeholder="`Paso ${i + 1}, ej. Camina hacia el Bloque D`" />
          <button
            v-if="nuevaRuta.pasos.length > 1"
            type="button"
            class="btn-quitar-paso"
            @click="quitarPaso(nuevaRuta.pasos, i)"
          >
            ✕
          </button>
        </div>
        <button type="button" class="btn-agregar-paso" @click="agregarPaso(nuevaRuta.pasos)">
          + Agregar instrucción
        </button>
      </div>

      <button type="submit" :disabled="creando">Agregar ruta</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="cargando" class="estado">Cargando rutas…</div>

    <ul v-else class="lista">
      <li v-for="ruta in rutas" :key="ruta.id" class="fila">
        <div v-if="editandoId === ruta.id" class="edicion">
          <div class="pasos-form">
            <div v-for="(paso, i) in pasosEdicion" :key="i" class="fila-paso">
              <span class="numero-paso">{{ i + 1 }}</span>
              <input v-model="pasosEdicion[i]" type="text" />
              <button
                v-if="pasosEdicion.length > 1"
                type="button"
                class="btn-quitar-paso"
                @click="quitarPaso(pasosEdicion, i)"
              >
                ✕
              </button>
            </div>
            <button type="button" class="btn-agregar-paso" @click="agregarPaso(pasosEdicion)">
              + Agregar instrucción
            </button>
          </div>
          <div class="botones-edicion">
            <button class="btn-guardar" @click="guardarEdicion(ruta)">Guardar</button>
            <button class="btn-cancelar" @click="editandoId = null">Cancelar</button>
          </div>
        </div>
        <template v-else>
          <div class="info">
            <span class="origen-destino">{{ ruta.qr.nombre }} → {{ ruta.bloque.nombre }}</span>
            <ol class="lista-pasos">
              <li v-for="(paso, i) in ruta.instrucciones" :key="i">{{ paso }}</li>
            </ol>
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
  gap: 0.6rem;
  margin-bottom: 1.25rem;
  padding: 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.form-nuevo select {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: inherit;
}

.pasos-form {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.fila-paso {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.numero-paso {
  flex-shrink: 0;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: var(--ng-navy);
  color: white;
  font-size: 0.72rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fila-paso input {
  flex: 1;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.88rem;
}

.btn-quitar-paso {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--ng-danger);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.2rem 0.4rem;
}

.btn-agregar-paso {
  align-self: flex-start;
  padding: 0.35rem 0.7rem;
  background: var(--ng-accent-light);
  color: var(--ng-navy);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
}

.form-nuevo > button[type='submit'] {
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
  gap: 0.35rem;
  flex: 1;
  min-width: 200px;
}

.origen-destino {
  font-weight: 600;
  font-size: 0.9rem;
}

.lista-pasos {
  padding-left: 1.1rem;
  font-size: 0.82rem;
  color: var(--ng-ink-soft);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
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
  gap: 0.6rem;
  width: 100%;
}

.botones-edicion {
  display: flex;
  gap: 0.4rem;
}
</style>
