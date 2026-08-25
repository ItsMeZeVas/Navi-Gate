<script setup>
import { useRouter } from 'vue-router'
import IconoPin from '../components/IconoPin.vue'

const router = useRouter()
</script>

<template>
  <div class="pagina">
    <header class="encabezado">
      <IconoPin :size="20" />
      <span class="marca">NAVI-GATE</span>
    </header>

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

    <div class="placeholder-mapa">Mapa del campus</div>
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

.placeholder-mapa {
  margin-top: 1.5rem;
  aspect-ratio: 4 / 3;
  background: #D9D9D9;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8A8A8A;
  font-size: 0.9rem;
}
</style>
