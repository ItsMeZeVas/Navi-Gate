<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import EspaciosTab from '../components/admin/EspaciosTab.vue'
import BloquesTab from '../components/admin/BloquesTab.vue'
import RutasTab from '../components/admin/RutasTab.vue'
import QrsTab from '../components/admin/QrsTab.vue'
import GrafoTab from '../components/admin/GrafoTab.vue'
import EscaneosTab from '../components/admin/EscaneosTab.vue'
import EventosTab from '../components/admin/EventosTab.vue'

const auth = useAuthStore()
const router = useRouter()

// La pestaña activa se recuerda: si se recarga la página, vuelves a donde ibas.
const PESTAÑAS = ['espacios', 'bloques', 'rutas', 'qrs', 'grafo', 'eventos', 'escaneos']
const CLAVE_PESTAÑA = 'navigate_admin_pestana'

function pestañaGuardada() {
  try {
    const guardada = sessionStorage.getItem(CLAVE_PESTAÑA)
    return PESTAÑAS.includes(guardada) ? guardada : 'espacios'
  } catch {
    return 'espacios'
  }
}

const pestañaActiva = ref(pestañaGuardada())

watch(pestañaActiva, (valor) => {
  try {
    sessionStorage.setItem(CLAVE_PESTAÑA, valor)
  } catch {
    // sin almacenamiento disponible: simplemente no se recuerda
  }
})

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

    <main class="contenido" :class="{ 'contenido--ancho': pestañaActiva === 'grafo' }">
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
        <button :class="{ activa: pestañaActiva === 'grafo' }" @click="pestañaActiva = 'grafo'">
          Grafo
        </button>
        <button :class="{ activa: pestañaActiva === 'eventos' }" @click="pestañaActiva = 'eventos'">
          Eventos
        </button>
        <button :class="{ activa: pestañaActiva === 'escaneos' }" @click="pestañaActiva = 'escaneos'">
          Estadísticas
        </button>
      </nav>

      <Transition name="cambio-pestana" mode="out-in">
        <EspaciosTab v-if="pestañaActiva === 'espacios'" />
        <BloquesTab v-else-if="pestañaActiva === 'bloques'" />
        <RutasTab v-else-if="pestañaActiva === 'rutas'" />
        <QrsTab v-else-if="pestañaActiva === 'qrs'" />
        <GrafoTab v-else-if="pestañaActiva === 'grafo'" />
        <EventosTab v-else-if="pestañaActiva === 'eventos'" />
        <EscaneosTab v-else-if="pestañaActiva === 'escaneos'" />
      </Transition>
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
  transition: max-width 0.15s ease;
}

.contenido--ancho {
  max-width: 1080px;
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
.cambio-pestana-enter-active,
.cambio-pestana-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.cambio-pestana-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.cambio-pestana-leave-to {
  opacity: 0;
}
</style>
