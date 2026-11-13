<script setup>
import { RouterView } from 'vue-router'
import BarraNavegacion from '../components/BarraNavegacion.vue'
</script>

<template>
  <div class="shell">
    <div class="area-vista">
      <RouterView v-slot="{ Component, route }">
        <Transition name="vista" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </div>
    <BarraNavegacion />
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
}

.area-vista {
  padding-bottom: 4.5rem;
}
.vista-enter-active,
.vista-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.vista-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.vista-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .vista-enter-active,
  .vista-leave-active {
    transition: none;
  }
}
</style>
