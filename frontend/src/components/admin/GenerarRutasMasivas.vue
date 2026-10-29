<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { api } from '../../lib/api'

// Generación masiva de rutas: de un QR (o de todos) hacia todos los bloques,
// espacios y puntos del grafo marcados como visibles en la app.
// Siempre en dos pasos: primero se calcula y se muestra qué va a pasar (sin
// escribir nada); solo al confirmar se guardan las rutas.
const props = defineProps({ qrs: { type: Array, default: () => [] } })

const auth = useAuthStore()
const alcance = ref('')
const calculando = ref(false)
const aplicando = ref(false)
const error = ref('')

const vistaPrevia = ref(null)
// clave de conflicto -> true si el admin eligió reemplazar. Por defecto se
// conserva lo que ya existe: nada se pisa sin que lo elijas.
const reemplazar = ref({})
const verTodosLosConflictos = ref(false)
const resultado = ref(null)

const LIMITE_VISIBLE = 25

function cuerpoAlcance() {
  return alcance.value === 'todos' ? { todos: true } : { qrId: Number(alcance.value) }
}

async function calcular() {
  if (!alcance.value) return
  calculando.value = true
  error.value = ''
  resultado.value = null
  vistaPrevia.value = null
  try {
    const datos = await api.previsualizarRutasMasivas(cuerpoAlcance(), auth.token)
    reemplazar.value = Object.fromEntries(datos.conflictos.map((c) => [c.clave, false]))
    verTodosLosConflictos.value = false
    vistaPrevia.value = datos
  } catch (err) {
    error.value = err.message
  } finally {
    calculando.value = false
  }
}

function decidirTodas(valor) {
  Object.keys(reemplazar.value).forEach((clave) => {
    reemplazar.value[clave] = valor
  })
}

const conflictosVisibles = computed(() => {
  const lista = vistaPrevia.value?.conflictos ?? []
  return verTodosLosConflictos.value ? lista : lista.slice(0, LIMITE_VISIBLE)
})

const totalAReemplazar = computed(() => Object.values(reemplazar.value).filter(Boolean).length)

const nadaQueAplicar = computed(
  () => !vistaPrevia.value || (vistaPrevia.value.resumen.nuevas === 0 && totalAReemplazar.value === 0),
)

async function aplicar() {
  const nuevas = vistaPrevia.value.resumen.nuevas
  const aviso = `Se crearán ${nuevas} ruta(s) y se reemplazarán ${totalAReemplazar.value}. ¿Continuar?`
  if (!confirm(aviso)) return

  aplicando.value = true
  error.value = ''
  try {
    resultado.value = await api.aplicarRutasMasivas(
      {
        ...cuerpoAlcance(),
        reemplazar: Object.keys(reemplazar.value).filter((clave) => reemplazar.value[clave]),
      },
      auth.token,
    )
    vistaPrevia.value = null
  } catch (err) {
    error.value = err.message
  } finally {
    aplicando.value = false
  }
}

function descartar() {
  vistaPrevia.value = null
  resultado.value = null
  error.value = ''
}

const etiquetaTipo = { bloque: 'Bloque', espacio: 'Espacio', nodo: 'Punto' }
const inalcanzables = computed(() => vistaPrevia.value?.sinCamino ?? resultado.value?.sinCamino ?? [])
</script>

<template>
  <section class="masivo">
    <h3>Generar todas las rutas de un QR</h3>
    <p class="ayuda">
      Calcula el camino desde un QR (o desde todos) hasta todos los bloques, espacios y puntos marcados como "Visible en
      la app", y los guarda como rutas normales (las puedes editar en la pestaña Rutas). Primero te muestra qué va a
      pasar: no se guarda nada hasta que confirmes.
    </p>

    <div class="fila">
      <select v-model="alcance" :disabled="calculando || aplicando">
        <option value="" disabled>Elige un QR…</option>
        <option value="todos">Todos los QR</option>
        <option v-for="qr in props.qrs" :key="qr.id" :value="qr.id">{{ qr.nombre }}</option>
      </select>
      <button type="button" class="btn-principal" :disabled="!alcance || calculando || aplicando" @click="calcular">
        {{ calculando ? 'Calculando…' : 'Calcular rutas' }}
      </button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <!-- Paso 1: vista previa -->
    <div v-if="vistaPrevia" class="revision">
      <div class="tarjetas">
        <div class="dato dato--nuevas">
          <span class="numero">{{ vistaPrevia.resumen.nuevas }}</span>
          <span class="etiqueta">rutas nuevas</span>
        </div>
        <div class="dato">
          <span class="numero">{{ vistaPrevia.resumen.iguales }}</span>
          <span class="etiqueta">ya existen iguales (se saltan)</span>
        </div>
        <div class="dato dato--aviso">
          <span class="numero">{{ vistaPrevia.resumen.conflictos }}</span>
          <span class="etiqueta">ya existen y son distintas</span>
        </div>
        <div class="dato dato--sin">
          <span class="numero">{{ vistaPrevia.resumen.sinCamino }}</span>
          <span class="etiqueta">destinos sin camino</span>
        </div>
      </div>

      <div v-if="vistaPrevia.conflictos.length" class="bloque-seccion">
        <h4>Rutas que ya existen y son distintas</h4>
        <p class="ayuda">
          Por defecto se conservan como están. Elige "Reemplazar" solo en las que quieras sustituir por la generada
          (se conservan sus fotos).
        </p>
        <div class="acciones-masivas">
          <button type="button" class="btn-mini" @click="decidirTodas(false)">Conservar todas</button>
          <button type="button" class="btn-mini" @click="decidirTodas(true)">Reemplazar todas</button>
        </div>

        <ul class="conflictos">
          <li v-for="c in conflictosVisibles" :key="c.clave" class="conflicto">
            <div class="c-titulo">
              <strong>{{ c.qrNombre }} → {{ c.destino.nombre }}</strong>
              <span class="chip">{{ etiquetaTipo[c.destino.tipo] }} · {{ c.destino.detalle }}</span>
            </div>
            <div class="comparacion">
              <div>
                <span class="rotulo">Actual</span>
                <ol>
                  <li v-for="(paso, i) in c.existente" :key="i">{{ paso }}</li>
                </ol>
              </div>
              <div>
                <span class="rotulo">Generada</span>
                <ol>
                  <li v-for="(paso, i) in c.nueva" :key="i">{{ paso }}</li>
                </ol>
              </div>
            </div>
            <div class="opciones">
              <label><input v-model="reemplazar[c.clave]" type="radio" :name="c.clave" :value="false" /> Conservar</label>
              <label><input v-model="reemplazar[c.clave]" type="radio" :name="c.clave" :value="true" /> Reemplazar</label>
            </div>
          </li>
        </ul>
        <button
          v-if="!verTodosLosConflictos && vistaPrevia.conflictos.length > LIMITE_VISIBLE"
          type="button"
          class="btn-mini"
          @click="verTodosLosConflictos = true"
        >
          Mostrar los {{ vistaPrevia.conflictos.length - LIMITE_VISIBLE }} restantes
        </button>
      </div>

      <div v-if="inalcanzables.length" class="bloque-seccion">
        <h4>Destinos a los que no hay camino desde el QR</h4>
        <p class="ayuda">Falta conectarlos en el mapa (una conexión rota o un punto suelto). No se crea ruta para ellos.</p>
        <details v-for="q in inalcanzables" :key="q.qrId" class="sin-camino">
          <summary>{{ q.qrNombre }}: {{ q.destinos.length }} sin camino</summary>
          <ul>
            <li v-for="(d, i) in q.destinos.slice(0, 40)" :key="i">{{ etiquetaTipo[d.tipo] }}: {{ d.nombre }}</li>
            <li v-if="q.destinos.length > 40" class="mas">…y {{ q.destinos.length - 40 }} más</li>
          </ul>
        </details>
      </div>

      <div class="confirmar">
        <button type="button" class="btn-principal" :disabled="nadaQueAplicar || aplicando" @click="aplicar">
          {{ aplicando ? 'Guardando…' : `Aplicar: crear ${vistaPrevia.resumen.nuevas}, reemplazar ${totalAReemplazar}` }}
        </button>
        <button type="button" class="btn-secundario" :disabled="aplicando" @click="descartar">Cancelar</button>
      </div>
    </div>

    <!-- Paso 2: resultado -->
    <div v-if="resultado" class="revision">
      <p class="exito">
        Listo: {{ resultado.creadas }} ruta(s) creada(s), {{ resultado.reemplazadas }} reemplazada(s),
        {{ resultado.conservadas }} conservada(s) y {{ resultado.iguales }} que ya estaban iguales. Las puedes ver y
        editar en la pestaña Rutas.
      </p>

      <div v-if="inalcanzables.length" class="bloque-seccion">
        <h4>Reporte: destinos sin camino</h4>
        <details v-for="q in inalcanzables" :key="q.qrId" class="sin-camino">
          <summary>{{ q.qrNombre }}: {{ q.destinos.length }} sin camino</summary>
          <ul>
            <li v-for="(d, i) in q.destinos.slice(0, 40)" :key="i">{{ etiquetaTipo[d.tipo] }}: {{ d.nombre }}</li>
            <li v-if="q.destinos.length > 40" class="mas">…y {{ q.destinos.length - 40 }} más</li>
          </ul>
        </details>
      </div>

      <button type="button" class="btn-secundario" @click="descartar">Cerrar reporte</button>
    </div>
  </section>
</template>

<style scoped>
.masivo {
  padding: 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.masivo h3 {
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--ng-navy);
}

.ayuda {
  font-size: 0.82rem;
  color: var(--ng-ink-soft);
  line-height: 1.45;
}

.fila {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.fila select {
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.88rem;
  font-family: inherit;
}

.btn-principal {
  padding: 0.55rem 1rem;
  background: var(--ng-navy);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.88rem;
}

.btn-principal:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-secundario {
  padding: 0.55rem 1rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.88rem;
  align-self: flex-start;
}

.btn-mini {
  padding: 0.3rem 0.65rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.78rem;
  cursor: pointer;
}

.error {
  color: var(--ng-danger);
}

.exito {
  color: var(--ng-navy);
  font-weight: 600;
  font-size: 0.9rem;
  line-height: 1.45;
}

.revision {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--color-border);
}

.tarjetas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.dato {
  flex: 1;
  min-width: 130px;
  background: var(--ng-cream);
  border-radius: 8px;
  padding: 0.7rem 0.8rem;
  display: flex;
  flex-direction: column;
}

.dato--nuevas .numero {
  color: var(--ng-navy);
}

.dato--aviso .numero {
  color: #8a6d00;
}

.dato--sin .numero {
  color: var(--ng-danger);
}

.numero {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
}

.etiqueta {
  font-size: 0.74rem;
  color: var(--ng-ink-soft);
}

.bloque-seccion {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bloque-seccion h4 {
  font-size: 0.9rem;
  color: var(--ng-navy);
}

.acciones-masivas {
  display: flex;
  gap: 0.5rem;
}

.conflictos {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.conflicto {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.c-titulo {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.88rem;
}

.chip {
  font-size: 0.68rem;
  font-weight: 600;
  background: var(--ng-accent-light);
  color: var(--ng-navy);
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
}

.comparacion {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  font-size: 0.8rem;
}

.comparacion ol {
  padding-left: 1.1rem;
}

.rotulo {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--ng-ink-soft);
  margin-bottom: 0.2rem;
}

.opciones {
  display: flex;
  gap: 1rem;
  font-size: 0.82rem;
}

.opciones label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.sin-camino {
  font-size: 0.82rem;
  background: var(--ng-cream);
  border-radius: 6px;
  padding: 0.4rem 0.7rem;
}

.sin-camino summary {
  cursor: pointer;
  font-weight: 600;
}

.sin-camino ul {
  list-style: none;
  padding: 0.4rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.mas {
  color: var(--ng-ink-soft);
}

.confirmar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

@media (max-width: 560px) {
  .comparacion {
    grid-template-columns: 1fr;
  }
}
</style>
