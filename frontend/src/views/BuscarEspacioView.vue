<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../lib/api'

const route = useRoute()
const slug = route.params.slug

const qr = ref(null)
const cargandoQr = ref(true)
const errorQr = ref('')

const termino = ref('')
const resultados = ref([])
const exacto = ref(true)
const buscando = ref(false)
const espacioActivo = ref(null)

// Lista de bloques únicos, para el modo "navegar por bloque".
const bloques = computed(() => {
  if (!qr.value) return []
  return qr.value.rutas.map((r) => r.bloque)
})

async function cargarQr() {
  cargandoQr.value = true
  errorQr.value = ''
  try {
    qr.value = await api.getQr(slug)
  } catch (err) {
    errorQr.value = err.message
  } finally {
    cargandoQr.value = false
  }
}

let timeoutId = null
function onInputBuscar() {
  espacioActivo.value = null
  clearTimeout(timeoutId)
  if (!termino.value.trim()) {
    resultados.value = []
    return
  }
  timeoutId = setTimeout(buscar, 300)
}

async function buscar() {
  buscando.value = true
  try {
    const data = await api.buscarEspacios({ buscar: termino.value, qr: slug })
    resultados.value = data.resultados
    exacto.value = data.exacto
  } catch (err) {
    resultados.value = []
  } finally {
    buscando.value = false
  }
}

async function verEspaciosDeBloque(bloque) {
  espacioActivo.value = null
  termino.value = ''
  buscando.value = true
  try {
    const data = await api.buscarEspacios({ piso: '', qr: slug })
    resultados.value = data.resultados.filter((e) => e.bloqueId === bloque.id)
    exacto.value = true
  } finally {
    buscando.value = false
  }
}

function seleccionarEspacio(espacio) {
  espacioActivo.value = espacio
}

onMounted(cargarQr)
</script>

<template>
  <div class="pagina">
    <header class="encabezado">
      <span class="marca">NAVI-GATE</span>
      <p v-if="qr" class="origen">Partiendo desde: <strong>{{ qr.nombre }}</strong></p>
    </header>

    <main class="contenido">
      <div v-if="cargandoQr" class="estado">Cargando tu punto de partida…</div>

      <div v-else-if="errorQr" class="estado estado--error">
        {{ errorQr }}
      </div>

      <template v-else>
        <div v-if="!espacioActivo">
          <label class="etiqueta" for="buscar">¿A dónde quieres ir?</label>
          <input
            id="buscar"
            v-model="termino"
            @input="onInputBuscar"
            type="text"
            placeholder="Busca un salón, oficina, cafetería…"
            class="input-buscar"
          />

          <div v-if="termino && !buscando && !exacto" class="aviso">
            No encontramos una coincidencia exacta. ¿Quisiste decir alguno de estos?
          </div>

          <ul v-if="resultados.length" class="lista-resultados">
            <li v-for="espacio in resultados" :key="espacio.id">
              <button class="tarjeta-resultado" @click="seleccionarEspacio(espacio)">
                <span class="codigo">{{ espacio.nombre }}</span>
                <span class="detalle">{{ espacio.bloque.nombre }} · Piso {{ espacio.piso }}</span>
              </button>
            </li>
          </ul>

          <div v-if="termino && !buscando && resultados.length === 0" class="estado">
            Sin resultados para "{{ termino }}".
          </div>

          <div class="separador">
            <span>o navega por bloque</span>
          </div>

          <div class="grid-bloques">
            <button
              v-for="bloque in bloques"
              :key="bloque.id"
              class="chip-bloque"
              @click="verEspaciosDeBloque(bloque)"
            >
              {{ bloque.nombre }}
            </button>
          </div>
        </div>

        <div v-else class="panel-ruta">
          <button class="volver" @click="espacioActivo = null">← Buscar otro lugar</button>

          <span class="codigo codigo--grande">{{ espacioActivo.nombre }}</span>
          <p class="ubicacion">{{ espacioActivo.bloque.nombre }} · Piso {{ espacioActivo.piso }}</p>

          <ol class="pasos">
            <li v-if="espacioActivo.rutaDesdeQr">{{ espacioActivo.rutaDesdeQr }}</li>
            <li>{{ espacioActivo.instruccionFinal }}</li>
          </ol>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.pagina {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.encabezado {
  background: var(--ng-navy);
  color: var(--ng-cream);
  padding: 1.5rem 1.25rem;
}

.marca {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.5rem;
  letter-spacing: 0.06em;
}

.origen {
  margin-top: 0.35rem;
  font-size: 0.9rem;
  color: rgba(245, 243, 237, 0.75);
}

.contenido {
  flex: 1;
  max-width: 480px;
  width: 100%;
  margin: 0 auto;
  padding: 1.75rem 1.25rem 3rem;
}

.etiqueta {
  display: block;
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--ng-navy);
  margin-bottom: 0.5rem;
}

.input-buscar {
  width: 100%;
  padding: 0.85rem 1rem;
  font-size: 1rem;
  border: 2px solid var(--ng-navy);
  border-radius: 6px;
  background: white;
  color: var(--ng-ink);
}

.input-buscar:focus {
  outline: 3px solid var(--ng-amber);
  outline-offset: 1px;
}

.aviso {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  color: var(--ng-ink-soft);
}

.lista-resultados {
  list-style: none;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.tarjeta-resultado {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font-size: 1rem;
}

.tarjeta-resultado:hover {
  border-color: var(--ng-navy);
}

.codigo {
  font-family: var(--font-mono);
  font-weight: 500;
  background: var(--ng-navy);
  color: var(--ng-amber);
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  font-size: 0.95rem;
}

.detalle {
  font-size: 0.85rem;
  color: var(--ng-ink-soft);
}

.estado {
  padding: 1.5rem 0;
  color: var(--ng-ink-soft);
}

.estado--error {
  color: var(--ng-danger);
}

.separador {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 2rem 0 1rem;
  color: var(--ng-ink-soft);
  font-size: 0.85rem;
}

.separador::before,
.separador::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.grid-bloques {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chip-bloque {
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--ng-navy);
  border-radius: 999px;
  background: white;
  color: var(--ng-navy);
  font-size: 0.9rem;
  cursor: pointer;
}

.chip-bloque:hover {
  background: var(--ng-navy);
  color: white;
}

.panel-ruta {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.volver {
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--ng-navy);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.5rem;
}

.codigo--grande {
  align-self: flex-start;
  font-size: 1.5rem;
  padding: 0.35rem 0.85rem;
}

.ubicacion {
  color: var(--ng-ink-soft);
}

.pasos {
  margin-top: 1rem;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  font-size: 1.05rem;
  line-height: 1.5;
}
</style>
