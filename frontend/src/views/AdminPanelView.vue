<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import EspaciosTab from '../components/admin/EspaciosTab.vue'
import BloquesTab from '../components/admin/BloquesTab.vue'
import RutasTab from '../components/admin/RutasTab.vue'
import QrsTab from '../components/admin/QrsTab.vue'

const auth = useAuthStore()
const router = useRouter()

const pestañaActiva = ref('espacios')

function salir() {
  auth.logout()
  router.push('/admin/login')
}
</script>

<template>
  <div class="pagina">
    <header class="encabezado">
      <span class="marca">NAVI-GATE · Admin</span>
      <button class="salir" @click="salir">Salir</button>
    </header>

    <main class="contenido">
      <nav class="pestañas">
        <button :class="{ activa: pestañaActiva === 'espacios' }" @click="pestañaActiva = 'espacios'">
          Espacios
        </button>
        <button :class="{ activa: pestañaActiva === 'bloques' }" @click="pestañaActiva = 'bloques'">
          Bloques
        </button>
        <button :class="{ activa: pestañaActiva === 'rutas' }" @click="pestañaActiva = 'rutas'">
          Rutas
        </button>
        <button :class="{ activa: pestañaActiva === 'qrs' }" @click="pestañaActiva = 'qrs'">
          QRs
        </button>
      </nav>

      <EspaciosTab v-if="pestañaActiva === 'espacios'" />
      <BloquesTab v-else-if="pestañaActiva === 'bloques'" />
      <RutasTab v-else-if="pestañaActiva === 'rutas'" />
      <QrsTab v-else-if="pestañaActiva === 'qrs'" />
    </main>
  </div>
</template>

<style scoped>
.pagina {
  min-height: 100vh;
}

.encabezado {
  background: var(--ng-navy);
  color: white;
  padding: 1.1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.marca {
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0.03em;
}

.salir {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: white;
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.contenido {
  max-width: 780px;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 3rem;
}

.pestañas {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.pestañas button {
  padding: 0.6rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--ng-ink-soft);
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
}

.pestañas button.activa {
  color: var(--ng-navy);
  border-bottom-color: var(--ng-navy);
}
</style>
