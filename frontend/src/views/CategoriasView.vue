<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const CATEGORIAS = [
  { tipo: 'SALON', etiqueta: 'Salones' },
  { tipo: 'OFICINA', etiqueta: 'Oficinas' },
  { tipo: 'LABORATORIO', etiqueta: 'Laboratorios' },
  { tipo: 'CAFETERIA', etiqueta: 'Cafeterías' },
  { tipo: 'BANO', etiqueta: 'Baños' },
  { tipo: 'OTRO', etiqueta: 'Otros' },
]

function irACategoria(tipo) {
  router.push({ path: '/app/buscar', query: { tipo } })
}
</script>

<template>
  <div class="pagina">
    <h1>Categorías</h1>
    <p class="subtitulo">Explora el campus por tipo de espacio.</p>

    <div class="grid">
      <button
        v-for="cat in CATEGORIAS"
        :key="cat.tipo"
        class="tile"
        @click="irACategoria(cat.tipo)"
      >
        {{ cat.etiqueta }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.pagina {
  padding: 1.5rem 1.25rem 1rem;
  max-width: 480px;
  margin: 0 auto;
}

h1 {
  font-size: 1.5rem;
}

.subtitulo {
  color: var(--ng-ink-soft);
  margin-top: 0.3rem;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.tile {
  padding: 1.5rem 1rem;
  border-radius: 12px;
  border: none;
  background: var(--ng-accent-light);
  color: var(--ng-navy);
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  text-align: left;
}

.tile:hover {
  background: var(--ng-navy);
  color: white;
}
</style>
