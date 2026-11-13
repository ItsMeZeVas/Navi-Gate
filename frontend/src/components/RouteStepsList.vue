<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  steps: { type: Array, default: () => [] },
  modelValue: { type: Number, default: 0 },
})

const emit = defineEmits(['update:modelValue'])
const stepButtons = ref([])

function seleccionar(index) {
  emit('update:modelValue', index)
}

watch(
  () => props.modelValue,
  async (index) => {
    await nextTick()
    const button = stepButtons.value[index]
    if (!button) return
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    button.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'nearest' })
  },
)
</script>

<template>
  <section v-if="steps.length" class="route-steps" aria-label="Pasos de la ruta">
    <div class="route-steps__controls">
      <button type="button" :disabled="modelValue <= 0" @click="seleccionar(modelValue - 1)">Anterior</button>
      <span>Paso {{ modelValue + 1 }} de {{ steps.length }}</span>
      <button type="button" :disabled="modelValue >= steps.length - 1" @click="seleccionar(modelValue + 1)">
        Siguiente
      </button>
    </div>

    <p class="route-steps__announcement" aria-live="polite" aria-atomic="true">
      Paso {{ modelValue + 1 }} de {{ steps.length }}: {{ steps[modelValue] }}
    </p>

    <ol class="route-steps__list">
      <li v-for="(step, index) in steps" :key="`${index}-${step}`">
        <button
          :ref="(element) => (stepButtons[index] = element)"
          type="button"
          class="route-steps__item"
          :class="{ 'route-steps__item--active': index === modelValue }"
          :aria-current="index === modelValue ? 'step' : undefined"
          :aria-label="`Mostrar paso ${index + 1}: ${step}`"
          @click="seleccionar(index)"
        >
          <span class="route-steps__number">{{ index + 1 }}</span>
          <span>{{ step }}</span>
        </button>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.route-steps { margin-top: 1rem; }
.route-steps__controls { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.route-steps__controls button {
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--ng-navy);
  border-radius: 8px;
  background: white;
  color: var(--ng-navy);
  cursor: pointer;
}
.route-steps__controls button:disabled { opacity: 0.45; cursor: not-allowed; }
.route-steps__controls span { font-size: 0.82rem; color: var(--ng-ink-soft); }
.route-steps__announcement { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.route-steps__list { max-height: 32vh; overflow-y: auto; list-style: none; margin-top: 0.7rem; display: flex; flex-direction: column; gap: 0.4rem; }
.route-steps__item { width: 100%; display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.7rem; border: 1px solid transparent; border-radius: 10px; background: white; color: var(--ng-ink); cursor: pointer; text-align: left; line-height: 1.4; }
.route-steps__item--active { border-color: var(--ng-navy); background: var(--ng-accent-light); }
.route-steps__item:focus-visible, .route-steps__controls button:focus-visible { outline: 3px solid var(--ng-amber); outline-offset: 2px; }
.route-steps__number { flex: 0 0 1.5rem; width: 1.5rem; height: 1.5rem; display: grid; place-items: center; border-radius: 50%; background: var(--ng-navy); color: white; font-size: 0.8rem; font-weight: 600; }
</style>
