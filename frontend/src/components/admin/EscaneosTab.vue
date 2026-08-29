<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { api } from '../../lib/api'

const auth = useAuthStore()
const cargando = ref(true)
const error = ref('')
const resumen = ref(null)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    resumen.value = await api.obtenerResumenEscaneos(auth.token)
  } catch (err) {
    error.value = err.message
  } finally {
    cargando.value = false
  }
}

const maxPorQr = computed(() => Math.max(...(resumen.value?.porQr.map((f) => f.total) ?? [0]), 1))

// --- Gráfico de línea simple (escaneos por día), sin librerías externas ---
const ANCHO = 600
const ALTO = 160
const PADDING = 24

function coordenadas(datos) {
  const maxTotal = Math.max(...datos.map((d) => d.total), 1)
  const pasoX = datos.length > 1 ? (ANCHO - PADDING * 2) / (datos.length - 1) : 0
  return datos.map((d, i) => ({
    x: PADDING + i * pasoX,
    y: ALTO - PADDING - (d.total / maxTotal) * (ALTO - PADDING * 2),
    ...d,
  }))
}

const puntosGrafico = computed(() => coordenadas(resumen.value?.porDia ?? []))
const lineaGrafico = computed(() => puntosGrafico.value.map((p) => `${p.x},${p.y}`).join(' '))

function formatearFecha(fechaIso) {
  const [, mes, dia] = fechaIso.split('-')
  return `${dia}/${mes}`
}

onMounted(cargar)
</script>

<template>
  <div class="escaneos-tab">
    <p class="ayuda">
      Cada vez que alguien escanea un QR y abre la app, queda un registro aquí. Sirve para saber qué puntos del
      campus se usan más y dónde podría valer la pena poner QRs adicionales.
    </p>

    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="cargando" class="estado">Cargando estadísticas…</div>

    <template v-else-if="resumen">
      <div class="tarjetas-resumen">
        <div class="tarjeta-resumen">
          <span class="numero">{{ resumen.total }}</span>
          <span class="etiqueta">Escaneos totales</span>
        </div>
        <div class="tarjeta-resumen">
          <span class="numero">{{ resumen.ultimos7dias }}</span>
          <span class="etiqueta">Últimos 7 días</span>
        </div>
        <div class="tarjeta-resumen">
          <span class="numero">{{ resumen.ultimos30dias }}</span>
          <span class="etiqueta">Últimos 30 días</span>
        </div>
      </div>

      <div class="seccion">
        <h3>Escaneos por día (últimos 30 días)</h3>
        <p v-if="resumen.porDia.length === 0" class="vacio">Todavía no hay escaneos en este período.</p>
        <svg v-else :viewBox="`0 0 ${ANCHO} ${ALTO}`" class="grafico-lineas" preserveAspectRatio="none">
          <line :x1="PADDING" :y1="ALTO - PADDING" :x2="ANCHO - PADDING" :y2="ALTO - PADDING" class="eje" />
          <polyline :points="lineaGrafico" class="linea" />
          <circle v-for="p in puntosGrafico" :key="p.fecha" :cx="p.x" :cy="p.y" r="2.5" class="punto">
            <title>{{ formatearFecha(p.fecha) }}: {{ p.total }}</title>
          </circle>
        </svg>
        <div v-if="resumen.porDia.length > 0" class="etiquetas-fechas">
          <span>{{ formatearFecha(resumen.porDia[0].fecha) }}</span>
          <span>{{ formatearFecha(resumen.porDia[resumen.porDia.length - 1].fecha) }}</span>
        </div>
      </div>

      <div class="seccion">
        <h3>QRs más escaneados</h3>
        <p v-if="resumen.porQr.length === 0" class="vacio">Todavía no hay escaneos registrados.</p>
        <div v-else class="ranking">
          <div v-for="fila in resumen.porQr" :key="fila.qrId" class="fila-ranking">
            <span class="nombre-qr">{{ fila.nombre }}</span>
            <div class="barra-fondo">
              <div class="barra" :style="{ width: (fila.total / maxPorQr) * 100 + '%' }"></div>
            </div>
            <span class="total-qr">{{ fila.total }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.escaneos-tab {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.ayuda {
  font-size: 0.85rem;
  color: var(--ng-ink-soft);
  line-height: 1.45;
}

.error {
  color: var(--ng-danger);
}

.estado,
.vacio {
  color: var(--ng-ink-soft);
  font-size: 0.88rem;
}

.tarjetas-resumen {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.tarjeta-resumen {
  flex: 1;
  min-width: 140px;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.numero {
  font-family: var(--font-display);
  font-size: 1.8rem;
  color: var(--ng-navy);
  font-weight: 700;
}

.etiqueta {
  font-size: 0.78rem;
  color: var(--ng-ink-soft);
}

.seccion {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1rem;
}

.seccion h3 {
  font-family: var(--font-display);
  font-size: 0.95rem;
  color: var(--ng-navy);
  margin-bottom: 0.75rem;
}

.grafico-lineas {
  width: 100%;
  height: 160px;
  display: block;
}

.eje {
  stroke: var(--color-border);
  stroke-width: 1;
}

.linea {
  fill: none;
  stroke: var(--ng-navy);
  stroke-width: 2;
}

.punto {
  fill: var(--ng-navy);
}

.etiquetas-fechas {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: var(--ng-ink-soft);
  margin-top: 0.3rem;
}

.ranking {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.fila-ranking {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) 3fr auto;
  align-items: center;
  gap: 0.6rem;
}

.nombre-qr {
  font-size: 0.85rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.barra-fondo {
  background: var(--ng-cream-mute);
  border-radius: 999px;
  height: 0.6rem;
  overflow: hidden;
}

.barra {
  background: var(--ng-navy);
  height: 100%;
  border-radius: 999px;
}

.total-qr {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--ng-navy);
  min-width: 1.6rem;
  text-align: right;
}
</style>
