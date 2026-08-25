<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { api } from '../lib/api'
import IconoPin from '../components/IconoPin.vue'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const espacio = ref(null)
const cargando = ref(true)
const error = ref('')

// Partimos el texto de la ruta + la instrucción final en "pasos" cortos,
// separando por puntos y comas, para que se vea como una lista numerada
// aunque el admin lo haya escrito como un párrafo seguido.
const pasos = computed(() => {
  if (!espacio.value) return []
  const textoCompleto = [espacio.value.rutaDesdeQr, espacio.value.instruccionFinal]
    .filter(Boolean)
    .join('. ')

  return textoCompleto
    .split(/[.,]\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.endsWith('.') ? p : `${p}.`))
})

async function cargar() {
  cargando.value = true
  try {
    const data = await api.buscarEspacios({ qr: session.qrSlug })
    espacio.value = data.resultados.find((e) => e.id === route.params.espacioId) || null
    if (!espacio.value) error.value = 'No encontramos ese espacio.'
  } catch (err) {
    error.value = err.message
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
</script>

<template>
  <div class="pagina">
    <header class="encabezado">
      <button class="volver" @click="router.back()">‹</button>
      <h1>¿Cómo llegar?</h1>
      <IconoPin :size="20" />
    </header>

    <div v-if="cargando" class="estado">Cargando ruta…</div>
    <div v-else-if="error" class="estado estado--error">{{ error }}</div>

    <template v-else>
      <div class="tarjeta-destino">
        <span class="nombre">{{ espacio.nombre }}</span>
        <span class="desde">Desde {{ session.qrNombre }}</span>
      </div>

      <div class="placeholder-mapa">Vista del recorrido</div>

      <ol class="pasos">
        <li v-for="(paso, i) in pasos" :key="i">
          <span class="numero">{{ i + 1 }}</span>
          <span class="texto">{{ paso }}</span>
        </li>
      </ol>
    </template>
  </div>
</template>

<style scoped>
.pagina {
  padding: 1.25rem 1.25rem 1rem;
  max-width: 480px;
  margin: 0 auto;
}

.encabezado {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.25rem;
}

.encabezado h1 {
  flex: 1;
  font-size: 1.2rem;
}

.volver {
  border: none;
  background: none;
  font-size: 1.5rem;
  color: var(--ng-navy);
  cursor: pointer;
  line-height: 1;
}

.tarjeta-destino {
  background: var(--ng-accent-light);
  border-radius: 10px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.nombre {
  font-weight: 700;
  color: var(--ng-navy);
}

.desde {
  font-size: 0.8rem;
  color: var(--ng-ink-soft);
}

.placeholder-mapa {
  margin-top: 1rem;
  aspect-ratio: 16 / 10;
  background: #D9D9D9;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8A8A8A;
  font-size: 0.9rem;
}

.pasos {
  list-style: none;
  margin-top: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.pasos li {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.numero {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--ng-navy);
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.texto {
  font-size: 0.95rem;
  padding-top: 0.1rem;
}

.estado {
  color: var(--ng-ink-soft);
  padding: 1.5rem 0;
}

.estado--error {
  color: var(--ng-danger);
}
</style>
