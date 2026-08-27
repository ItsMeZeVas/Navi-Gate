<script setup>
import { ref, onMounted, nextTick } from 'vue'
import QRCode from 'qrcode'
import { useAuthStore } from '../../stores/auth'
import { api } from '../../lib/api'

const auth = useAuthStore()
const qrs = ref([])
const cargando = ref(true)
const error = ref('')

const nombreNuevo = ref('')
const creando = ref(false)

const editandoId = ref(null)
const nombreEdicion = ref('')

// URL pública a la que apunta cada QR (donde la persona cae al escanear).
function urlDe(qr) {
  return `${window.location.origin}/qr/${qr.slug}`
}

async function cargar() {
  cargando.value = true
  try {
    qrs.value = await api.listarQrs(auth.token)
  } catch (err) {
    error.value = err.message
  } finally {
    cargando.value = false
  }
  // Esperamos a que Vue termine de renderizar los <canvas> (aparecen
  // recién cuando cargando pasa a false) antes de dibujar en ellos.
  await nextTick()
  dibujarTodos()
}

function dibujarTodos() {
  qrs.value.forEach((qr) => {
    const canvas = document.getElementById(`qr-canvas-${qr.id}`)
    if (canvas) {
      // Genera la imagen localmente: no depende de ningún servicio
      // externo, así que el código nunca expira ni deja de funcionar.
      // margin: 4 (el mínimo recomendado por el estándar QR) para que
      // las cámaras lo reconozcan con confianza, sobre todo si se
      // escanea desde una pantalla en vez de impreso.
      QRCode.toCanvas(canvas, urlDe(qr), { width: 160, margin: 4 })
    }
  })
}

function descargar(qr) {
  const canvas = document.getElementById(`qr-canvas-${qr.id}`)
  if (!canvas) return
  const enlace = document.createElement('a')
  enlace.download = `qr-${qr.slug}.png`
  enlace.href = canvas.toDataURL('image/png')
  enlace.click()
}

async function crear() {
  if (!nombreNuevo.value.trim()) return
  creando.value = true
  error.value = ''
  try {
    await api.crearQr(nombreNuevo.value.trim(), auth.token)
    nombreNuevo.value = ''
    await cargar()
  } catch (err) {
    error.value = err.message
  } finally {
    creando.value = false
  }
}

function empezarEdicion(qr) {
  editandoId.value = qr.id
  nombreEdicion.value = qr.nombre
}

async function guardarEdicion(qr) {
  if (!nombreEdicion.value.trim()) return
  try {
    await api.actualizarQr(qr.id, nombreEdicion.value.trim(), auth.token)
    editandoId.value = null
    await cargar()
  } catch (err) {
    error.value = err.message
  }
}

async function eliminar(qr) {
  const confirmado = confirm(
    `¿Eliminar "${qr.nombre}"? El QR físico que hayas impreso con esta URL dejará de funcionar, y se borrarán sus rutas asociadas.`,
  )
  if (!confirmado) return
  try {
    await api.eliminarQr(qr.id, auth.token)
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
      <input v-model="nombreNuevo" type="text" placeholder="Nombre del punto, ej. Entrada del Bosque" />
      <button type="submit" :disabled="creando">Agregar QR</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="cargando" class="estado">Cargando QRs…</div>

    <ul v-else class="lista">
      <li v-for="qr in qrs" :key="qr.id" class="tarjeta">
        <canvas :id="`qr-canvas-${qr.id}`"></canvas>

        <div class="info">
          <div v-if="editandoId === qr.id" class="edicion">
            <input v-model="nombreEdicion" type="text" @keyup.enter="guardarEdicion(qr)" />
            <div class="botones-edicion">
              <button class="btn-guardar" @click="guardarEdicion(qr)">Guardar</button>
              <button class="btn-cancelar" @click="editandoId = null">Cancelar</button>
            </div>
          </div>
          <template v-else>
            <span class="nombre">{{ qr.nombre }}</span>
            <span class="url">{{ urlDe(qr) }}</span>
          </template>

          <div class="acciones">
            <button class="btn-descargar" @click="descargar(qr)">Descargar PNG</button>
            <button class="btn-editar" @click="empezarEdicion(qr)">Renombrar</button>
            <button class="btn-eliminar" @click="eliminar(qr)">Eliminar</button>
          </div>
        </div>
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
  gap: 0.75rem;
}

.tarjeta {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.tarjeta canvas {
  border-radius: 6px;
  flex-shrink: 0;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 180px;
}

.nombre {
  font-weight: 600;
}

.url {
  font-size: 0.78rem;
  color: var(--ng-ink-soft);
  word-break: break-all;
}

.acciones {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.btn-descargar,
.btn-editar,
.btn-eliminar,
.btn-guardar,
.btn-cancelar {
  padding: 0.4rem 0.7rem;
  border-radius: 6px;
  font-size: 0.78rem;
  cursor: pointer;
}

.btn-descargar {
  background: var(--ng-navy);
  color: white;
  border: none;
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
  gap: 0.4rem;
}

.edicion input {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--ng-navy);
  border-radius: 6px;
}

.botones-edicion {
  display: flex;
  gap: 0.4rem;
}
</style>
