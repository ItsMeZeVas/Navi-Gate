<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import MapPin from './MapPin.vue'

const props = defineProps({
  map: { type: Object, required: true },
  pins: { type: Array, default: () => [] },
  activePinId: { type: [String, Number], default: null },
  highlightedPinIds: { type: Array, default: () => [] },
  pinStyle: { type: String, default: 'normal' },
  showAllPins: { type: Boolean, default: false },
  debug: { type: Boolean, default: false },
  alt: { type: String, default: '' },
})

const emit = defineEmits(['pin-click', 'calibrate'])
const imageError = ref(false)
const hasValidImage = ref(false)
const currentSrc = ref(props.map.src)
const previousSrc = ref('')
const transitioning = ref(false)
const copied = ref(false)
const lastCoordinate = ref(null)
let transitionTimer = null

watch(() => props.map.src, (src) => {
  if (!src) return
  if (src === currentSrc.value) {
    imageError.value = false
    return
  }
  const preload = new Image()
  preload.onload = () => {
    if (props.map.src !== src) return
    previousSrc.value = currentSrc.value
    currentSrc.value = src
    imageError.value = false
    hasValidImage.value = true
    transitioning.value = true
    requestAnimationFrame(() => { transitioning.value = false })
    clearTimeout(transitionTimer)
    transitionTimer = setTimeout(() => { previousSrc.value = '' }, 380)
  }
  preload.onerror = () => {
    if (props.map.src === src) imageError.value = true
  }
  preload.src = src
})

onBeforeUnmount(() => clearTimeout(transitionTimer))

function calibrate(event) {
  if (!props.debug || imageError.value || props.map.src !== currentSrc.value || event.target.closest('.map-pin')) return
  const rect = event.currentTarget.getBoundingClientRect()
  const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100))
  const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100))
  lastCoordinate.value = { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) }
  copied.value = false
  emit('calibrate', lastCoordinate.value)
}

async function copiarCoordenadas() {
  if (!lastCoordinate.value) return
  const value = `x: ${lastCoordinate.value.x}, y: ${lastCoordinate.value.y}`
  try {
    await navigator.clipboard.writeText(value)
    copied.value = true
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <section class="map-viewer" :aria-label="map.name || 'Mapa del campus'">
    <div v-if="hasValidImage || !imageError" class="map-viewer__canvas" @click="calibrate">
      <img
        v-if="previousSrc"
        class="map-viewer__image map-viewer__image--previous"
        :class="{ 'map-viewer__image--transitioning': transitioning }"
        :src="previousSrc"
        alt=""
        aria-hidden="true"
      />
      <img
        class="map-viewer__image"
        :class="{ 'map-viewer__image--entering': transitioning }"
        :src="currentSrc"
        :alt="map.src === currentSrc ? (alt || map.description || map.name || 'Mapa del campus') : 'Último mapa disponible'"
        @error="imageError = true"
        @load="hasValidImage = true"
      />
      <MapPin
        v-for="pin in pins"
        :key="pin.id"
        :pin="pin"
        :active="String(pin.id) === String(activePinId)"
        :highlighted="highlightedPinIds.some((id) => String(id) === String(pin.id))"
        :style-type="pin.style || pinStyle"
        :show-label="showAllPins || pin.style === 'origen' || pin.style === 'destino' || pin.style === 'destino-final' || pin.style === 'paso'"
        @click="emit('pin-click', pin)"
      />
    </div>
    <div v-else class="map-viewer__error" role="status">
      <strong>No se pudo cargar este mapa.</strong>
      <span>Verifica la ruta de imagen configurada: {{ map.src }}</span>
    </div>
    <p v-if="imageError && hasValidImage" class="map-viewer__warning" role="status">
      No se pudo cargar el mapa nuevo; se conserva el último mapa disponible.
    </p>
    <div v-if="debug" class="map-viewer__debug" aria-live="polite">
      <span>Calibración activa: haz clic sobre el plano para obtener coordenadas en porcentaje.</span>
      <span>Pines en la configuración de este mapa: {{ pins.length }}</span>
      <template v-if="lastCoordinate">
        <code>x: {{ lastCoordinate.x }}, y: {{ lastCoordinate.y }}</code>
        <button type="button" @click="copiarCoordenadas">{{ copied ? 'Copiado' : 'Copiar' }}</button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.map-viewer { width: 100%; }
.map-viewer__canvas {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 14px;
  background: #e5e7e9;
  line-height: 0;
  cursor: crosshair;
}
.map-viewer__image { display: block; width: 100%; height: auto; transition: opacity 350ms ease; }
.map-viewer__image--previous { position: absolute; inset: 0; height: 100%; object-fit: contain; pointer-events: none; }
.map-viewer__image--previous.map-viewer__image--transitioning { opacity: 1; }
.map-viewer__image--previous:not(.map-viewer__image--transitioning) { opacity: 0; }
.map-viewer__image--entering { opacity: 0; }
.map-viewer__warning { margin-top: 0.4rem; color: #795500; font-size: 0.82rem; }
.map-viewer__error {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  border-radius: 14px;
  background: #e5e7e9;
  color: #45515c;
  text-align: center;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.map-viewer__debug {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  color: #45515c;
  font-size: 0.8rem;
}
.map-viewer__debug code { padding: 0.2rem 0.4rem; background: #f0f2f4; border-radius: 4px; }
.map-viewer__debug button { cursor: pointer; }

@media (prefers-reduced-motion: reduce) {
  .map-viewer__image { transition: none; }
}
</style>
