<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { api } from '../lib/api'
import IconoPin from './IconoPin.vue'

// Burbuja lateral con los eventos que están ocurriendo ahora. Si no hay
// ninguno en curso, no se dibuja nada. Es un extra opcional: si la carga
// falla, simplemente no aparece y no estorba el resto de la pantalla.
const router = useRouter()
const session = useSessionStore()

const eventos = ref([])
const abierto = ref(false)
const ahora = ref(Date.now())
let temporizador = null

async function cargar() {
  try {
    eventos.value = await api.getEventosVigentes(session.qrSlug)
    ahora.value = Date.now()
  } catch {
    // Silencioso a propósito: ver comentario arriba.
  }
  if (eventos.value.length === 0) abierto.value = false
}

function alPresionarTecla(e) {
  if (e.key === 'Escape') abierto.value = false
}

onMounted(() => {
  cargar()
  // Refresca cada minuto para que entren/salgan eventos y cambien los
  // estados ("Próximo" -> "En curso") sin recargar la página.
  temporizador = setInterval(cargar, 60 * 1000)
  window.addEventListener('keydown', alPresionarTecla)
})

onUnmounted(() => {
  clearInterval(temporizador)
  window.removeEventListener('keydown', alPresionarTecla)
})

// --- Formato de fechas (hora local del dispositivo) ---
function hora(iso) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
}

function fechaCorta(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

function mismoDia(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function rango(inicio, fin) {
  if (mismoDia(inicio, fin)) return `${hora(inicio)} – ${hora(fin)}`
  return `${fechaCorta(inicio)} ${hora(inicio)} – ${fechaCorta(fin)} ${hora(fin)}`
}

function hasta(fin) {
  return mismoDia(fin, ahora.value) ? `Hasta las ${hora(fin)}` : `Hasta el ${fechaCorta(fin)}, ${hora(fin)}`
}

function estadoSub(sub) {
  return ahora.value >= new Date(sub.inicio).getTime()
    ? { clave: 'en-curso', texto: 'En curso' }
    : { clave: 'proximo', texto: 'Próximo' }
}

function irARuta(sub) {
  abierto.value = false
  router.push(`/app/como-llegar/${sub.espacio.id}`)
}
</script>

<template>
  <div v-if="eventos.length">
    <button class="burbuja" :aria-label="`Ver eventos en curso (${eventos.length})`" @click="abierto = true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="5" width="18" height="16" rx="2.5" />
        <path d="M3 10h18M8 3v4M16 3v4" stroke-linecap="round" />
      </svg>
      <span class="contador">{{ eventos.length }}</span>
    </button>

    <div v-if="abierto" class="fondo" @click.self="abierto = false">
      <section class="panel" role="dialog" aria-modal="true" aria-label="Eventos en curso">
        <header class="panel-cabecera">
          <h2>Eventos ahora</h2>
          <button class="cerrar" aria-label="Cerrar" @click="abierto = false">✕</button>
        </header>

        <article v-for="evento in eventos" :key="evento.id" class="evento">
          <img v-if="evento.imagen" :src="evento.imagen" alt="" class="banner" />
          <h3>{{ evento.nombre }}</h3>
          <p class="hasta">{{ hasta(evento.fin) }}</p>
          <p v-if="evento.descripcion" class="descripcion">{{ evento.descripcion }}</p>

          <ul v-if="evento.subEventos.length" class="subs">
            <li v-for="sub in evento.subEventos" :key="sub.id" class="sub">
              <img v-if="sub.imagen" :src="sub.imagen" alt="" class="sub-imagen" />
              <div class="sub-info">
                <div class="sub-titulo">
                  <span class="sub-nombre">{{ sub.nombre }}</span>
                  <span class="chip" :class="`chip--${estadoSub(sub).clave}`">{{ estadoSub(sub).texto }}</span>
                </div>
                <span class="sub-hora">{{ rango(sub.inicio, sub.fin) }}</span>
                <span v-if="sub.espacio" class="sub-lugar">
                  <IconoPin :size="13" />
                  {{ sub.espacio.nombre }} · {{ sub.espacio.bloque?.nombre }} · Piso {{ sub.espacio.piso }}
                </span>
                <p v-if="sub.descripcion" class="sub-descripcion">{{ sub.descripcion }}</p>
                <button v-if="sub.tieneRuta" class="btn-ruta" @click="irARuta(sub)">Cómo llegar</button>
              </div>
            </li>
          </ul>
          <p v-else class="sin-subs">Sin actividades pendientes por ahora.</p>
        </article>
      </section>
    </div>
  </div>
</template>

<style scoped>
.burbuja {
  position: fixed;
  right: 0.9rem;
  bottom: 6rem;
  z-index: 20;
  width: 3.4rem;
  height: 3.4rem;
  border-radius: 50%;
  border: none;
  background: var(--ng-navy);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(15, 106, 78, 0.35);
  animation: pulso 2.4s ease-out infinite;
}

.contador {
  position: absolute;
  top: -0.15rem;
  right: -0.15rem;
  min-width: 1.15rem;
  height: 1.15rem;
  padding: 0 0.25rem;
  border-radius: 999px;
  background: var(--ng-danger);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes pulso {
  0% {
    box-shadow: 0 6px 18px rgba(15, 106, 78, 0.35), 0 0 0 0 rgba(15, 106, 78, 0.4);
  }
  70%,
  100% {
    box-shadow: 0 6px 18px rgba(15, 106, 78, 0.35), 0 0 0 14px rgba(15, 106, 78, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .burbuja {
    animation: none;
  }
}

.fondo {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(31, 42, 36, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.panel {
  width: 100%;
  max-width: 480px;
  max-height: 82vh;
  overflow-y: auto;
  background: var(--ng-cream);
  border-radius: 18px 18px 0 0;
  padding: 1rem 1.1rem calc(1.5rem + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.panel-cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-cabecera h2 {
  font-size: 1.1rem;
  color: var(--ng-navy);
}

.cerrar {
  border: none;
  background: var(--ng-cream-mute);
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  cursor: pointer;
  color: var(--ng-ink);
}

.evento {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.banner {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 10px;
  margin-bottom: 0.3rem;
}

.evento h3 {
  font-size: 1.05rem;
  color: var(--ng-navy);
}

.hasta {
  font-size: 0.78rem;
  color: var(--ng-ink-soft);
  font-weight: 600;
}

.descripcion {
  font-size: 0.88rem;
}

.subs {
  list-style: none;
  margin-top: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.sub {
  display: flex;
  gap: 0.7rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--color-border);
}

.sub-imagen {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
}

.sub-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.sub-titulo {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.sub-nombre {
  font-weight: 700;
  font-size: 0.92rem;
}

.chip {
  font-size: 0.64rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
}

.chip--en-curso {
  background: var(--ng-navy);
  color: white;
}

.chip--proximo {
  background: var(--ng-accent-light);
  color: var(--ng-navy);
}

.sub-hora {
  font-size: 0.8rem;
  color: var(--ng-ink-soft);
}

.sub-lugar {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ng-navy);
}

.sub-descripcion {
  font-size: 0.82rem;
}

.btn-ruta {
  align-self: flex-start;
  margin-top: 0.3rem;
  padding: 0.45rem 0.95rem;
  border: none;
  border-radius: 999px;
  background: var(--ng-navy);
  color: white;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.sin-subs {
  font-size: 0.82rem;
  color: var(--ng-ink-soft);
}
</style>
