<script setup>
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { to: '/app/inicio', label: 'Inicio', icon: 'home' },
  { to: '/app/buscar', label: 'Buscar', icon: 'buscar' },
  { to: '/app/explorar', label: 'Explorar', icon: 'explorar' },
  { to: '/app/categorias', label: 'Categorías', icon: 'categorias' },
]

function activo(to) {
  return route.path.startsWith(to)
}
</script>

<template>
  <nav class="barra">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="item"
      :class="{ activo: activo(tab.to) }"
    >
      <svg v-if="tab.icon === 'home'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 11l9-8 9 8" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M5 10v10h14V10" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <svg v-else-if="tab.icon === 'buscar'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" stroke-linecap="round" />
      </svg>
      <svg v-else-if="tab.icon === 'explorar'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M15 9l-2 6-6 2 2-6 6-2Z" stroke-linejoin="round" />
      </svg>
      <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
      <span>{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.barra {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: white;
  border-top: 1px solid var(--color-border);
  padding: 0.4rem 0 calc(0.4rem + env(safe-area-inset-bottom));
  z-index: 10;
}

.item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.35rem 0;
  color: var(--ng-nav-inactive);
  text-decoration: none;
  font-size: 0.7rem;
}

.item.activo {
  color: var(--ng-navy);
  font-weight: 600;
}
</style>
