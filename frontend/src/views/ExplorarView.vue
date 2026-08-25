<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { api } from '../lib/api'
import IconoPin from '../components/IconoPin.vue'

const router = useRouter()
const session = useSessionStore()

const vista = ref('mapa') // 'mapa' | 'lista'
const espacios = ref([])
const cargando = ref(true)

// Posiciones decorativas para los pines sobre el mapa (mientras no
// tengamos coordenadas reales ni el plano ilustrado del campus).
const POSICIONES = [
  { top: '20%', left: '30%' },
  { top: '35%', left: '65%' },
  { top: '55%', left: '25%' },
  { top: '65%', left: '55%' },
  { top: '45%', left: '80%' },
  { top: '75%', left: '15%' },
]

const bloques = ref([])

async function cargar() {
  cargando.value = true
  try {
    const data = await api.buscarEspacios({ qr: session.qrSlug })
    espacios.value = data.resultados
    const vistos = new Map()
    data.resultados.forEach((e) => vistos.set(e.bloque.id, e.bloque))
    bloques.value = [...vistos.values()]
  } finally {
    cargando.value = false
  }
}

function irABloque(bloque) {
  router.push({ path: '/app/buscar', query: { bloqueId: bloque.id } })
}

function irADetalle(espacio) {
  router.push(`/app/como-llegar/${espacio.id}`)
}

onMounted(cargar)
</script>

<template>
  <div class="pagina">
    <header class="encabezado">
      <button class="volver" @click="router.push('/app/inicio')">‹</button>
      <h1>Explorar el mapa</h1>
      <IconoPin :size="20" />
    </header>

    <div class="toggle">
      <button :class="{ activo: vista === 'mapa' }" @click="vista = 'mapa'">Mapa General</button>
      <button :class="{ activo: vista === 'lista' }" @click="vista = 'lista'">Lista</button>
    </div>

    <div v-if="cargando" class="estado">Cargando…</div>

    <div v-else-if="vista === 'mapa'" class="mapa">
      <button
        v-for="(bloque, i) in bloques"
        :key="bloque.id"
        class="pin"
        :style="POSICIONES[i % POSICIONES.length]"
        @click="irABloque(bloque)"
        :title="bloque.nombre"
      >
        <IconoPin :size="26" />
      </button>
    </div>

    <ul v-else class="lista">
      <li v-for="espacio in espacios" :key="espacio.id">
        <button class="tarjeta" @click="irADetalle(espacio)">
          <div class="info">
            <span class="nombre">{{ espacio.nombre }}</span>
            <span class="detalle">{{ espacio.bloque.nombre }}, Piso {{ espacio.piso }}</span>
          </div>
          <span class="flecha">›</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pagina {
  padding: 1.25rem 1.25rem 1rem;
  max-width: 480px;
  margin: 0 auto;
}

.encabezado {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.encabezado h1 {
  flex: 1;
  font-size: 1.2rem;
}

.volver {
  border: none;
  background: none;
  font-size: 1.5rem;
  color: var(--ng-navy);
  cursor: pointer;
  line-height: 1;
}

.toggle {
  display: flex;
  background: var(--ng-cream-mute);
  border-radius: 999px;
  padding: 0.25rem;
  margin-bottom: 1rem;
}

.toggle button {
  flex: 1;
  padding: 0.5rem;
  border: none;
  background: none;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ng-ink-soft);
  cursor: pointer;
}

.toggle button.activo {
  background: var(--ng-navy);
  color: white;
}

.mapa {
  position: relative;
  aspect-ratio: 4 / 5;
  background: #D9D9D9;
  border-radius: 14px;
  overflow: hidden;
}

.pin {
  position: absolute;
  transform: translate(-50%, -100%);
  background: none;
  border: none;
  color: var(--ng-navy);
  cursor: pointer;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
}

.estado {
  color: var(--ng-ink-soft);
  text-align: center;
  padding: 2rem 0;
}

.lista {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

.info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.nombre {
  font-weight: 600;
}

.detalle {
  font-size: 0.8rem;
  color: var(--ng-ink-soft);
}

.flecha {
  color: var(--ng-ink-soft);
  font-size: 1.2rem;
}
</style>
