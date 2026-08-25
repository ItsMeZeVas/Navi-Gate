<script setup>
import { RouterView } from 'vue-router'
import BarraNavegacion from '../components/BarraNavegacion.vue'
</script>

<template>
  <div class="shell">
    <div class="area-vista">
      <RouterView />
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
</style>
