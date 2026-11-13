<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { api } from '../lib/api'
import IconoPin from '../components/IconoPin.vue'
import MapViewer from '../components/MapViewer.vue'
import RouteStepsList from '../components/RouteStepsList.vue'
import { campusMaps } from '../config/maps'
import { getMapLocationsByNodeId } from '../lib/mapLocations'
import { inferirBloque, resolveRouteStepLocations, resolverEntradaOrigen } from '../lib/routeStepLocations'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

// La misma pantalla sirve para un Espacio y para un punto del grafo
// (punto de referencia, ascensor…): "espacio" guarda el destino en ambos casos.
const espacio = ref(null)
const esPunto = Boolean(route.params.puntoId)
const cargando = ref(true)
const error = ref('')
const fotoActiva = ref(0)
const mapaSeleccionadoId = ref('')
const pasoActivo = ref(0)

// Los pasos de la ruta ya vienen como lista desde el backend; solo
// agregamos la instrucción final del espacio como último paso.
const pasos = computed(() => {
  if (!espacio.value) return []
  // Un punto del grafo no tiene instrucción final: su ruta ya termina en él.
  return [...(espacio.value.rutaDesdeQr || []), espacio.value.instruccionFinal].filter(Boolean)
})
const nodoPorPaso = computed(() => {
  if (!espacio.value) return []
  const nodos = espacio.value.rutaNodosPorPaso || []
  if (esPunto || !espacio.value.instruccionFinal) return nodos
  return [...nodos, espacio.value.nodoGrafoId ?? espacio.value.bloqueNodoGrafoId ?? null]
})

// Avisos por cierres que puso el admin (nodos marcados como "Cerrada").
// Un destino cerrado se sigue mostrando, con su ruta normal; si la ruta
// pasaba por algo cerrado, el backend ya mandó la alternativa (si hay).
const avisoCierre = computed(() => {
  if (!espacio.value) return null
  if (espacio.value.cerrado) {
    return { tipo: 'cerrado', texto: 'Este lugar está cerrado en este momento.' }
  }
  if (espacio.value.estadoRuta === 'alternativa') {
    return { tipo: 'alternativa', texto: 'Hay un tramo cerrado. Esta es una ruta alternativa.' }
  }
  if (espacio.value.estadoRuta === 'sin_alternativa') {
    return {
      tipo: 'cerrado',
      texto: 'Hay un tramo cerrado y no encontramos otro camino. Es posible que no puedas pasar.',
    }
  }
  return null
})

// Fotos de la ruta (el trayecto hasta el bloque) primero, y luego
// las del espacio en sí (el detalle final), todas en un solo carrusel.
const fotosCarrusel = computed(() => {
  if (!espacio.value) return []
  return [...(espacio.value.rutaFotos || []), ...(espacio.value.fotos || [])]
})

const nodoDestinoId = computed(() => {
  if (!espacio.value) return null
  // Punto buscable = su propio ID de nodo; espacio = nodo del espacio o del bloque.
  return esPunto ? espacio.value.id : espacio.value.nodoGrafoId ?? espacio.value.bloqueNodoGrafoId
})
const ubicacionesDestino = computed(() =>
  getMapLocationsByNodeId(nodoDestinoId.value).sort((a, b) => (b.map.priority || 0) - (a.map.priority || 0)),
)
const ubicacionEntradaOrigen = computed(() => {
  const ubicacionesGrafo = getMapLocationsByNodeId(session.qrNodoGrafoId)
  return resolverEntradaOrigen(session.qrNombre, campusMaps, ubicacionesGrafo[0]?.map.id)
})
const ubicacionesOrigen = computed(() => {
  const ubicacionesGrafo = getMapLocationsByNodeId(session.qrNodoGrafoId)
  const entrada = ubicacionEntradaOrigen.value
  if (entrada && !ubicacionesGrafo.some((item) => item.map.id === entrada.map.id && item.pin.id === entrada.pin.id)) {
    return [...ubicacionesGrafo, entrada]
  }
  return ubicacionesGrafo
})
const ubicacionesPorPaso = computed(() => {
  const results = []
  const destinoBloque = espacio.value?.bloque?.nombre || ''
  const destinoNombre = espacio.value?.nombre || espacio.value?.etiqueta || ''
  const contextoBase = {
    destinationBlockName: destinoBloque,
    destinationName: destinoNombre,
    destinationBlockCode: inferirBloque(`${destinoBloque} ${destinoNombre}`),
    destinationFloor: espacio.value?.piso ?? null,
    destinationMapIds: ubicacionesDestino.value.map((item) => item.map.id),
    originName: session.qrNombre,
    originBlockCode: inferirBloque(session.qrNombre),
  }
  let currentMapId = ubicacionesOrigen.value[0]?.map.id || ubicacionEntradaOrigen.value?.map.id || null
  let currentBlockCode = contextoBase.originBlockCode || contextoBase.destinationBlockCode

  pasos.value.forEach((paso, index) => {
    const codigoBloqueAnterior = currentBlockCode
    const codigoEnPaso = inferirBloque(paso)
    if (codigoEnPaso) currentBlockCode = codigoEnPaso
    let locations = resolveRouteStepLocations(
      { text: paso, nodeId: nodoPorPaso.value[index] },
      campusMaps,
      { ...contextoBase, currentMapId, currentBlockCode, previousBlockCode: codigoBloqueAnterior },
    )
    if (!locations.length && index === pasos.value.length - 1 && !esPunto) locations = ubicacionesDestino.value

    // Si el primer paso arranca en el mismo plano que el QR, añade también
    // la entrada como origen visual, junto al marcador del paso.
    const entrada = ubicacionEntradaOrigen.value
    if (index === 0 && entrada && locations.some((item) => item.map.id === entrada.map.id)) {
      const yaIncluida = locations.some((item) => item.pin?.id === entrada.pin.id)
      if (!yaIncluida) locations.unshift(entrada)
    }

    if (locations.length) currentMapId = locations[0].map.id
    if (codigoEnPaso) currentBlockCode = codigoEnPaso
    results.push(locations)
  })
  return results
})
const ubicacionesEfectivasPasos = computed(() => {
  let ultimaUbicacion = []
  return ubicacionesPorPaso.value.map((locations) => {
    if (locations.length) ultimaUbicacion = locations
    if (ultimaUbicacion.length) return ultimaUbicacion
    return ubicacionesOrigen.value
  })
})

// El paso activo decide primero; los mapas de destino/origen siguen disponibles
// como alternativas en las pestañas, pero no se muestran pines ajenos al paso.
const opcionesMapa = computed(() => {
  const opciones = new Map()
  for (const ubicacion of ubicacionesEfectivasPasos.value[pasoActivo.value] || []) {
    const existente = opciones.get(ubicacion.map.id)
    if (existente) {
      if (ubicacion.pin) existente.pasos.push(ubicacion.pin)
    } else {
      opciones.set(ubicacion.map.id, {
        map: ubicacion.map,
        pasos: ubicacion.pin ? [ubicacion.pin] : [],
        destino: null,
        origen: null,
      })
    }
  }
  for (const ubicacion of ubicacionesDestino.value) {
    const existente = opciones.get(ubicacion.map.id)
    if (existente) existente.destino = ubicacion.pin
    else opciones.set(ubicacion.map.id, { map: ubicacion.map, pasos: [], destino: ubicacion.pin, origen: null })
  }
  for (const ubicacion of ubicacionesOrigen.value) {
    const existente = opciones.get(ubicacion.map.id)
    if (existente) existente.origen = ubicacion.pin
    else opciones.set(ubicacion.map.id, { map: ubicacion.map, pasos: [], destino: null, origen: ubicacion.pin })
  }
  return [...opciones.values()]
})
const mapaActivo = computed(() =>
  opcionesMapa.value.find((opcion) => opcion.map.id === mapaSeleccionadoId.value) || opcionesMapa.value[0] || null,
)
const pinesMapaActivo = computed(() => {
  if (!mapaActivo.value) return []
  const esPasoFinal = pasoActivo.value === pasos.value.length - 1
  const elPasoEsMeta = mapaActivo.value.destino
    && (esPasoFinal || mapaActivo.value.pasos?.some((pin) => String(pin.id) === String(mapaActivo.value.destino.id)))
  if (elPasoEsMeta) {
    return [{ ...mapaActivo.value.destino, style: 'destino-final' }]
  }
  return (mapaActivo.value.pasos || []).map((pin) => ({
    ...pin,
    style: pin.style || 'paso',
  }))
})
const hayRuta = computed(() => Boolean(espacio.value?.rutaDesdeQr?.length))
function seleccionarMapa(id) {
  mapaSeleccionadoId.value = id
}

const imagenesPrecargadas = new Set()
function precargarMapa(map) {
  if (!map?.src || imagenesPrecargadas.has(map.src)) return
  imagenesPrecargadas.add(map.src)
  const imagen = new Image()
  imagen.onerror = () => imagenesPrecargadas.delete(map.src)
  imagen.src = map.src
}

function mapaParaPaso(index) {
  const ubicacion = ubicacionesEfectivasPasos.value[index]?.[0]
  return ubicacion?.map || null
}

watch(pasoActivo, (index) => {
  mapaSeleccionadoId.value = ''
  precargarMapa(mapaParaPaso(index - 1))
  precargarMapa(mapaParaPaso(index + 1))
})
watch(ubicacionesEfectivasPasos, () => {
  precargarMapa(mapaParaPaso(pasoActivo.value - 1))
  precargarMapa(mapaParaPaso(pasoActivo.value + 1))
}, { immediate: true })

async function cargar() {
  cargando.value = true
  pasoActivo.value = 0
  try {
    if (esPunto) {
      const puntos = await api.buscarPuntos({ qr: session.qrSlug })
      espacio.value = puntos.find((p) => String(p.id) === route.params.puntoId) || null
      if (!espacio.value) error.value = 'No encontramos ese lugar.'
    } else {
      const data = await api.buscarEspacios({ qr: session.qrSlug })
      // route.params.espacioId llega como texto; espacio.id es numérico
      // desde el cambio a IDs autoincrementales, así que comparamos
      // convirtiendo ambos al mismo tipo.
      espacio.value = data.resultados.find((e) => String(e.id) === route.params.espacioId) || null
      if (!espacio.value) error.value = 'No encontramos ese espacio.'
    }
  } catch (err) {
    error.value = err.message
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
</script>

<template>
  <div class="pagina">
    <header class="encabezado">
      <button class="volver" @click="router.back()">‹</button>
      <h1>¿Cómo llegar?</h1>
      <IconoPin :size="20" />
    </header>

    <div v-if="cargando" class="estado">Cargando ruta…</div>
    <div v-else-if="error" class="estado estado--error">{{ error }}</div>

    <template v-else>
      <div class="tarjeta-destino">
        <span class="nombre">{{ espacio.nombre }}</span>
        <span class="desde">Desde {{ session.qrNombre }}</span>
      </div>

      <div v-if="avisoCierre" class="aviso-cierre" :class="`aviso-cierre--${avisoCierre.tipo}`" role="status">
        {{ avisoCierre.texto }}
      </div>

      <section class="mapa-ruta" aria-label="Ubicación del origen y destino">
        <div v-if="opcionesMapa.length > 1" class="mapa-pestanas" role="group" aria-label="Mapas disponibles">
          <button
            v-for="opcion in opcionesMapa"
            :key="opcion.map.id"
            type="button"
            :aria-pressed="mapaActivo?.map.id === opcion.map.id"
            @click="seleccionarMapa(opcion.map.id)"
          >
            {{ opcion.map.name }}
            <span v-if="opcion.pasos?.length"> · paso</span>
            <span v-if="opcion.destino"> · destino</span>
            <span v-if="opcion.origen"> · origen</span>
          </button>
        </div>

        <p v-if="!ubicacionesDestino.length" class="mapa-aviso" role="status">
          Aún no hay un pin configurado para este destino.
          <template v-if="opcionesMapa.length"> Se muestra el mapa del origen cuando está disponible.</template>
        </p>
        <p v-if="pasos.length && !ubicacionesPorPaso[pasoActivo]?.length" class="mapa-aviso" role="status">
          Este paso no tiene un pin propio configurado; se conserva la última ubicación conocida.
        </p>
        <MapViewer
          v-if="mapaActivo"
          :map="mapaActivo.map"
          :pins="pinesMapaActivo"
          :highlighted-pin-ids="pinesMapaActivo.map((pin) => pin.id)"
        />
        <p v-else class="mapa-aviso" role="status">
          No hay mapas configurados para este destino ni para el punto de partida.
        </p>
        <div v-if="mapaActivo" class="leyenda-mapa" aria-label="Leyenda de pines">
          <span v-if="mapaActivo.pasos?.some((pin) => pin.style !== 'origen')"><i class="leyenda-punto leyenda-punto--paso"></i>Paso activo</span>
          <span v-if="mapaActivo.pasos?.some((pin) => pin.style === 'origen')"><i class="leyenda-punto leyenda-punto--origen"></i>Inicio del tramo</span>
          <span v-if="pinesMapaActivo.some((pin) => pin.style === 'destino-final')"><i class="leyenda-punto leyenda-punto--meta"></i>Meta</span>
        </div>
      </section>

      <div v-if="fotosCarrusel.length" class="carrusel">
        <img :src="fotosCarrusel[fotoActiva]" alt="Foto de referencia del recorrido" />
        <div v-if="fotosCarrusel.length > 1" class="puntos">
          <button
            v-for="(foto, i) in fotosCarrusel"
            :key="i"
            class="punto"
            :class="{ activo: i === fotoActiva }"
            @click="fotoActiva = i"
          ></button>
        </div>
      </div>
      <p v-if="!hayRuta" class="aviso-ruta-vacia" role="status">
        No hay instrucciones de ruta disponibles para este destino desde el punto de partida actual.
      </p>
      <RouteStepsList v-else v-model="pasoActivo" :steps="pasos" />
    </template>
  </div>
</template>

<style scoped>
.aviso-cierre {
  margin-bottom: 1rem;
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
}

.aviso-cierre--cerrado {
  background: #fde8e8;
  color: #8a1f14;
  border: 1px solid #f1b5ae;
}

.aviso-cierre--alternativa {
  background: #fff4dc;
  color: #7a5200;
  border: 1px solid #f0d28a;
}

.pagina {
  padding: 1.25rem 1.25rem 1rem;
  max-width: 480px;
  margin: 0 auto;
}

.encabezado {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.25rem;
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

.tarjeta-destino {
  background: var(--ng-accent-light);
  border-radius: 10px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.nombre {
  font-weight: 700;
  color: var(--ng-navy);
}

.desde {
  font-size: 0.8rem;
  color: var(--ng-ink-soft);
}

.carrusel {
  margin-top: 1rem;
  position: relative;
}

.mapa-ruta { margin-top: 1rem; }
.mapa-pestanas { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.6rem; }
.mapa-pestanas button {
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: white;
  color: var(--ng-ink-soft);
  cursor: pointer;
  font-size: 0.78rem;
}
.mapa-pestanas button[aria-pressed='true'] { border-color: var(--ng-navy); background: var(--ng-navy); color: white; }
.mapa-aviso, .aviso-ruta-vacia { color: var(--ng-ink-soft); font-size: 0.88rem; }
.leyenda-mapa { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem; font-size: 0.8rem; color: var(--ng-ink-soft); }
.leyenda-mapa span { display: inline-flex; align-items: center; gap: 0.35rem; }
.leyenda-punto { width: 0.7rem; height: 0.7rem; display: inline-block; border-radius: 50%; }
.leyenda-punto--paso { background: #48e9f7; border: 1px solid #17324d; }
.leyenda-punto--meta { background: #25834a; }
.leyenda-punto--origen { background: #25834a; }
.aviso-ruta-vacia { margin-top: 1.25rem; }

.carrusel img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: 14px;
  display: block;
}

.puntos {
  position: absolute;
  bottom: 0.6rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.4rem;
}

.punto {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: 0;
}

.punto.activo {
  background: white;
}

.estado {
  color: var(--ng-ink-soft);
  padding: 1.5rem 0;
}

.estado--error {
  color: var(--ng-danger);
}
</style>
