<script setup>
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
import IconoPin from '../components/IconoPin.vue'
import BurbujaEventos from '../components/BurbujaEventos.vue'

const router = useRouter()
const session = useSessionStore()

// Mismos `tipo` que usa CategoriasView, así /app/buscar filtra igual.
const ACCESOS = [
  { tipo: 'BANO', etiqueta: 'Baños' },
  { tipo: 'CAFETERIA', etiqueta: 'Cafeterías' },
  { tipo: 'SALON', etiqueta: 'Salones' },
  { tipo: 'LABORATORIO', etiqueta: 'Laboratorios' },
]

function irATipo(tipo) {
  router.push({ path: '/app/buscar', query: { tipo } })
}
</script>

<template>
  <div class="pagina">
    <header class="encabezado">
      <IconoPin :size="20" />
      <span class="marca">NAVI-GATE</span>
    </header>

    <div v-if="session.qrNombre" class="chip-origen">
      <IconoPin :size="14" />
      <span>Desde: {{ session.qrNombre }}</span>
    </div>

    <h1>¿A dónde vamos?</h1>
    <p class="subtitulo">Explora el campus o busca un lugar.</p>

    <button class="buscador-falso" @click="router.push('/app/buscar')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" stroke-linecap="round" />
      </svg>
      <span>Buscar salón, oficina, baños…</span>
    </button>

    <button class="boton-mapa" @click="router.push('/app/explorar')">
      Explorar el mapa
    </button>

    <button class="mapa-campus" @click="router.push('/app/explorar')" aria-label="Explorar el mapa del campus">
      <img src="@/assets/MapaInicio.jpeg" alt="Mapa general del campus" loading="lazy" />
    </button>

    <section class="accesos">
      <div class="accesos-cabecera">
        <h2>Accesos rápidos</h2>
        <button class="ver-todas" @click="router.push('/app/categorias')">Ver todas</button>
      </div>
      <div class="accesos-grid">
        <button v-for="a in ACCESOS" :key="a.tipo" class="acceso" @click="irATipo(a.tipo)">
          {{ a.etiqueta }}
        </button>
      </div>
    </section>

    <BurbujaEventos />
  </div>
</template>

<style scoped>
.pagina {
  padding: 1.5rem 1.25rem;
  max-width: 480px;
  margin: 0 auto;
}

.encabezado {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--ng-navy);
  margin-bottom: 1.5rem;
}

.marca {
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0.03em;
}

h1 {
  font-size: 1.6rem;
}

.chip-origen {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  background: var(--ng-accent-light);
  color: var(--ng-navy);
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.subtitulo {
  color: var(--ng-ink-soft);
  margin-top: 0.3rem;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
}

.buscador-falso {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: white;
  color: var(--ng-ink-soft);
  font-size: 0.95rem;
  cursor: pointer;
  text-align: left;
}

.boton-mapa {
  width: 100%;
  margin-top: 1rem;
  padding: 0.85rem;
  border-radius: 999px;
  border: none;
  background: var(--ng-navy);
  color: white;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
}

.mapa-campus {
  display: block;
  width: 100%;
  margin-top: 1.5rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  overflow: hidden;
  background: #D9D9D9;
  cursor: pointer;
}

.mapa-campus img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.accesos {
  margin-top: 1.5rem;
}

.accesos-cabecera {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.accesos-cabecera h2 {
  font-size: 1rem;
  color: var(--ng-navy);
}

.ver-todas {
  border: none;
  background: none;
  color: var(--ng-navy);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.accesos-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.acceso {
  padding: 0.85rem;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: white;
  color: var(--ng-navy);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}
</style>
