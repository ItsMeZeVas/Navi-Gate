<script setup>
import IconoPin from './IconoPin.vue'

defineProps({
  pin: { type: Object, required: true },
  active: { type: Boolean, default: false },
  highlighted: { type: Boolean, default: false },
  styleType: { type: String, default: 'normal' },
  showLabel: { type: Boolean, default: false },
})

defineEmits(['click'])
</script>

<template>
  <button
    class="map-pin"
    :class="[`map-pin--${styleType}`, { 'map-pin--activo': active, 'map-pin--resaltado': highlighted, 'map-pin--con-etiqueta': showLabel }]"
    :style="{ left: `${pin.x}%`, top: `${pin.y}%` }"
    :aria-label="`${pin.label || 'Ubicación'}${active ? ', activo' : ''}`"
    :title="pin.label || 'Ubicación'"
    @click.stop="$emit('click', pin)"
  >
    <IconoPin :size="28" />
    <span v-if="showLabel" class="map-pin__label">{{ pin.label }}</span>
  </button>
</template>

<style scoped>
.map-pin {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ng-navy, #17324d);
  cursor: pointer;
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 28%));
  transform: translate(-50%, -100%);
}

.map-pin--activo,
.map-pin--destino { color: #c73535; }
.map-pin--destino-final { color: #25834a; }
.map-pin--origen { color: #25834a; }
.map-pin--paso { color: #48e9f7; filter: drop-shadow(0 2px 3px rgb(0 0 0 / 60%)); }
.map-pin--con-etiqueta { z-index: 3; }
.map-pin--resaltado,
.map-pin--destino-final { animation: pin-arrive 1.5s ease-in-out 2; }
.map-pin__label {
  margin-top: 2px;
  padding: 2px 5px;
  border-radius: 4px;
  background: white;
  color: #17212b;
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
}

.map-pin:focus-visible { outline: 3px solid #f0b429; outline-offset: 2px; }

@keyframes pin-arrive {
  0%, 100% { transform: translate(-50%, -100%) scale(1); }
  35% { transform: translate(-50%, -118%) scale(1.18); }
}

@media (prefers-reduced-motion: reduce) {
  .map-pin--resaltado { animation: none; }
}
</style>
