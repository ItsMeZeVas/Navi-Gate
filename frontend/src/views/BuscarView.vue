<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { api } from '../lib/api'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const termino = ref('')
const resultados = ref([])
// Puntos del grafo visibles en la app (puntos de referencia, ascensores…).
const puntos = ref([])
const exacto = ref(true)
const buscando = ref(false)

const filtroTipo = ref(route.query.tipo || '')
const filtroBloque = ref(route.query.bloqueId || '')

const ETIQUETAS_TIPO = {
  SALON: 'Salones',
  OFICINA: 'Oficinas',
  LABORATORIO: 'Laboratorios',
  CAFETERIA: 'Cafeterías',
  BANO: 'Baños',
  OTRO: 'Otros',
}

const ETIQUETAS_PUNTO = {
  PUNTO_REFERENCIA: 'Punto de referencia',
  ESCALERA: 'Escalera',
  ASCENSOR: 'Ascensor',
  PASILLO: 'Pasillo',
  PUERTA: 'Puerta',
}

function detallePunto(punto) {
  const tipo = ETIQUETAS_PUNTO[punto.tipo] || 'Punto'
  return punto.piso != null ? `${tipo}, Piso ${punto.piso}` : tipo
}

// Los puntos no tienen tipo ni bloque, así que se ocultan cuando hay un filtro por ellos.
async function buscarPuntos() {
  if (filtroTipo.value || filtroBloque.value) {
    puntos.value = []
    return
  }
  try {
    puntos.value = await api.buscarPuntos({ qr: session.qrSlug, buscar: termino.value || '' })
  } catch {
    // Es un extra: si falla, la búsqueda de espacios sigue funcionando.
    puntos.value = []
  }
}

async function buscar() {
  buscando.value = true
  buscarPuntos()
  try {
    const params = { qr: session.qrSlug }
    if (termino.value) params.buscar = termino.value
    if (filtroTipo.value) params.tipo = filtroTipo.value
    if (filtroBloque.value) params.bloqueId = filtroBloque.value

    const data = await api.buscarEspacios(params)
    resultados.value = data.resultados
    exacto.value = data.exacto
  } catch (err) {
    resultados.value = []
  } finally {
    buscando.value = false
  }
}

let timeoutId = null
function onInput() {
  clearTimeout(timeoutId)
  timeoutId = setTimeout(buscar, 300)
}

function limpiarFiltro() {
  filtroTipo.value = ''
  filtroBloque.value = ''
  router.replace('/app/buscar')
  buscar()
}

function irADetalle(espacio) {
  router.push(`/app/como-llegar/${espacio.id}`)
}

function irAPunto(punto) {
  router.push(`/app/como-llegar-punto/${punto.id}`)
}

onMounted(buscar)
watch(() => route.query, () => {
  filtroTipo.value = route.query.tipo || ''
  filtroBloque.value = route.query.bloqueId || ''
  buscar()
})
</script>

<template>
  <div class="pagina">
    <div v-if="session.qrNombre" class="chip-origen">
      <span>Desde: {{ session.qrNombre }}</span>
    </div>

    <div class="buscador">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" stroke-linecap="round" />
      </svg>
      <input
        v-model="termino"
        @input="onInput"
        type="text"
        placeholder="Buscar salón, oficina, baños…"
        autofocus
      />
    </div>

    <div v-if="filtroTipo || filtroBloque" class="chip-filtro">
      <span>{{ ETIQUETAS_TIPO[filtroTipo] || 'Filtrado por bloque' }}</span>
      <button @click="limpiarFiltro">✕</button>
    </div>

    <p v-if="termino && !buscando && !exacto" class="aviso">
      No encontramos una coincidencia exacta. ¿Quisiste decir alguno de estos?
    </p>

    <ul class="lista">
      <li v-for="espacio in resultados" :key="espacio.id">
        <button class="tarjeta" @click="irADetalle(espacio)">
          <div class="info">
            <span class="nombre">{{ espacio.nombre }}</span>
            <span class="detalle">{{ espacio.bloque.nombre }}, Piso {{ espacio.piso }}</span>
          </div>
          <span class="flecha">›</span>
        </button>
      </li>
    </ul>

    <ul v-if="puntos.length" class="lista lista--puntos">
      <li v-for="punto in puntos" :key="`punto-${punto.id}`">
        <button class="tarjeta" @click="irAPunto(punto)">
          <div class="info">
            <span class="nombre">{{ punto.nombre }}</span>
            <span class="detalle">{{ detallePunto(punto) }}</span>
          </div>
          <span class="flecha">›</span>
        </button>
      </li>
    </ul>

    <p v-if="!buscando && resultados.length === 0 && puntos.length === 0" class="estado">
      Sin resultados{{ termino ? ` para "${termino}"` : '' }}.
    </p>
  </div>
</template>

<style scoped>
.pagina {
  padding: 1.25rem 1.25rem 1rem;
  max-width: 480px;
  margin: 0 auto;
}

.chip-origen {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.7rem;
  background: var(--ng-accent-light);
  color: var(--ng-navy);
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  margin-bottom: 0.85rem;
}

.buscador {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: white;
  color: var(--ng-ink-soft);
}

.buscador input {
  border: none;
  outline: none;
  flex: 1;
  font-size: 0.95rem;
  background: transparent;
  color: var(--ng-ink);
}

.chip-filtro {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.85rem;
  padding: 0.35rem 0.7rem;
  background: var(--ng-accent-light);
  color: var(--ng-navy);
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
}

.chip-filtro button {
  border: none;
  background: none;
  color: var(--ng-navy);
  cursor: pointer;
  font-size: 0.85rem;
}

.aviso {
  margin-top: 0.85rem;
  font-size: 0.85rem;
  color: var(--ng-ink-soft);
}

.lista {
  list-style: none;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lista--puntos {
  margin-top: 0.5rem;
}

.tarjeta {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.9rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
}

.tarjeta:hover {
  border-color: var(--ng-navy);
}

.info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.nombre {
  font-weight: 600;
  color: var(--ng-ink);
}

.detalle {
  font-size: 0.8rem;
  color: var(--ng-ink-soft);
}

.flecha {
  color: var(--ng-ink-soft);
  font-size: 1.2rem;
}

.estado {
  margin-top: 1.5rem;
  color: var(--ng-ink-soft);
  text-align: center;
}
</style>
