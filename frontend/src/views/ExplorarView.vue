<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { api } from '../lib/api'
import IconoPin from '../components/IconoPin.vue'
import MapViewer from '../components/MapViewer.vue'
import { campusMaps } from '../config/maps'

const router = useRouter()
const route = useRoute()
const session = useSessionStore()

const vista = ref('mapa') // 'mapa' | 'lista'
const espacios = ref([])
const cargando = ref(true)

const mapaId = ref(campusMaps[0]?.id)
const mostrarEtiquetas = ref(false)
const mapaActivo = computed(() => campusMaps.find((map) => map.id === mapaId.value))
const modoCalibracion = computed(() => route.query.debug === 'pins')

async function cargar() {
  cargando.value = true
  try {
    const data = await api.buscarEspacios({ qr: session.qrSlug })
    espacios.value = data.resultados
  } finally {
    cargando.value = false
  }
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

    <div v-else-if="vista === 'mapa'" class="mapa-panel">
      <label class="selector-mapa">
        Mapa
        <select v-model="mapaId">
          <option v-for="map in campusMaps" :key="map.id" :value="map.id">{{ map.name }}</option>
        </select>
      </label>
      <label class="opcion-etiquetas">
        <input v-model="mostrarEtiquetas" type="checkbox" /> Mostrar etiquetas de todos los pines
      </label>
      <MapViewer
        v-if="mapaActivo"
        :map="mapaActivo"
        :pins="mapaActivo.pins"
        :show-all-pins="mostrarEtiquetas"
        :debug="modoCalibracion"
      />
      <p v-if="modoCalibracion" class="aviso-debug">Modo desarrollador activo. Edita el archivo de configuración para guardar la coordenada deseada.</p>
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

.mapa-panel { display: flex; flex-direction: column; gap: 0.65rem; }
.selector-mapa { display: flex; align-items: center; gap: 0.6rem; font-size: 0.9rem; font-weight: 600; }
.selector-mapa select { flex: 1; min-width: 0; padding: 0.55rem; border: 1px solid var(--color-border); border-radius: 8px; background: white; }
.opcion-etiquetas { display: flex; align-items: center; gap: 0.45rem; color: var(--ng-ink-soft); font-size: 0.82rem; }
.aviso-debug { color: #795500; font-size: 0.8rem; margin: 0; }
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
