<script setup>
import { ref, computed, onMounted } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { useAuthStore } from '../../stores/auth'
import { api } from '../../lib/api'

const auth = useAuthStore()
const { zoomIn, zoomOut, fitView } = useVueFlow()

// --- Estado general ---
const cargando = ref(true)
const error = ref('')
const nodosOriginales = ref([]) // datos crudos del backend, uno por nodo
const edgesOriginales = ref([])
const nodosFlow = ref([]) // formato que espera VueFlow
const edgesFlow = ref([])

const TIPOS_INTERMEDIOS = [
  { valor: 'PASILLO', etiqueta: 'Pasillo' },
  { valor: 'ESCALERA', etiqueta: 'Escalera' },
  { valor: 'ASCENSOR', etiqueta: 'Ascensor' },
  { valor: 'PUERTA', etiqueta: 'Puerta' },
  { valor: 'PUNTO_REFERENCIA', etiqueta: 'Punto de referencia' },
]

function nombreTipo(tipo) {
  const encontrado = TIPOS_INTERMEDIOS.find((t) => t.valor === tipo)
  if (encontrado) return encontrado.etiqueta
  if (tipo === 'QR') return 'QR'
  if (tipo === 'BLOQUE') return 'Bloque'
  if (tipo === 'ESPACIO') return 'Espacio'
  return tipo
}

function esNodoLigado(nodo) {
  return nodo.tipo === 'QR' || nodo.tipo === 'BLOQUE' || nodo.tipo === 'ESPACIO'
}

function textoNodo(nodo) {
  let texto = nodo.etiqueta
  if ((nodo.tipo === 'ESCALERA' || nodo.tipo === 'ASCENSOR') && nodo.piso != null && nodo.pisoHasta != null) {
    texto += ` (piso ${nodo.piso}→${nodo.pisoHasta})`
  } else if (nodo.tipo === 'ESPACIO' && nodo.piso != null) {
    texto += ` (piso ${nodo.piso})`
  } else if (nodo.piso != null) {
    texto += ` (piso ${nodo.piso})`
  }
  return texto
}

function nodoAFlow(nodo) {
  return {
    id: String(nodo.id),
    position: { x: nodo.posX, y: nodo.posY },
    label: textoNodo(nodo),
    class: ['nodo-grafo', `nodo-tipo-${nodo.tipo.toLowerCase()}`],
    data: nodo,
  }
}

function edgeAFlow(edge) {
  return {
    id: String(edge.id),
    source: String(edge.origenId),
    target: String(edge.destinoId),
  }
}

async function cargarGrafo() {
  cargando.value = true
  error.value = ''
  try {
    const { nodos, edges } = await api.obtenerGrafo(auth.token)
    nodosOriginales.value = nodos
    edgesOriginales.value = edges
    nodosFlow.value = nodos.map(nodoAFlow)
    edgesFlow.value = edges.map(edgeAFlow)
  } catch (err) {
    error.value = err.message
  } finally {
    cargando.value = false
  }
}

// --- Agregar nodo intermedio ---
const nuevoNodo = ref({ tipo: 'PASILLO', etiqueta: '', piso: '', pisoHasta: '' })
const creandoNodo = ref(false)
const esVertical = computed(() => nuevoNodo.value.tipo === 'ESCALERA' || nuevoNodo.value.tipo === 'ASCENSOR')

async function agregarNodo() {
  if (!nuevoNodo.value.etiqueta.trim()) return
  creandoNodo.value = true
  error.value = ''
  try {
    const nodo = await api.crearNodoGrafo(
      {
        tipo: nuevoNodo.value.tipo,
        etiqueta: nuevoNodo.value.etiqueta.trim(),
        piso: nuevoNodo.value.piso === '' ? null : Number(nuevoNodo.value.piso),
        pisoHasta: esVertical.value && nuevoNodo.value.pisoHasta !== '' ? Number(nuevoNodo.value.pisoHasta) : null,
        posX: 80 + Math.random() * 300,
        posY: 80 + Math.random() * 300,
      },
      auth.token,
    )
    nodosOriginales.value.push(nodo)
    nodosFlow.value.push(nodoAFlow(nodo))
    nuevoNodo.value = { tipo: 'PASILLO', etiqueta: '', piso: '', pisoHasta: '' }
  } catch (err) {
    error.value = err.message
  } finally {
    creandoNodo.value = false
  }
}

// --- Arrastrar nodo: guardar nueva posición ---
async function onNodeDragStop({ node }) {
  try {
    await api.actualizarNodoGrafo(Number(node.id), { posX: node.position.x, posY: node.position.y }, auth.token)
    const original = nodosOriginales.value.find((n) => n.id === Number(node.id))
    if (original) {
      original.posX = node.position.x
      original.posY = node.position.y
    }
  } catch (err) {
    error.value = err.message
  }
}

// --- Conectar dos nodos (crear edge) ---
async function onConnect(conexion) {
  error.value = ''
  try {
    const edge = await api.crearEdgeGrafo(Number(conexion.source), Number(conexion.target), auth.token)
    edgesOriginales.value.push(edge)
    edgesFlow.value.push(edgeAFlow(edge))
  } catch (err) {
    error.value = err.message
  }
}

// --- Selección de nodo / edge para editar o eliminar ---
const nodoSeleccionado = ref(null)
const edgeSeleccionado = ref(null)
const edicionNodo = ref({ etiqueta: '', piso: '', pisoHasta: '' })

function onNodeClick({ node }) {
  edgeSeleccionado.value = null
  nodoSeleccionado.value = nodosOriginales.value.find((n) => n.id === Number(node.id)) || null
  if (nodoSeleccionado.value) {
    edicionNodo.value = {
      etiqueta: nodoSeleccionado.value.etiqueta || '',
      piso: nodoSeleccionado.value.piso ?? '',
      pisoHasta: nodoSeleccionado.value.pisoHasta ?? '',
    }
  }
}

function onEdgeClick({ edge }) {
  nodoSeleccionado.value = null
  edgeSeleccionado.value = edgesOriginales.value.find((e) => e.id === Number(edge.id)) || null
}

function deseleccionar() {
  nodoSeleccionado.value = null
  edgeSeleccionado.value = null
}

async function guardarEdicionNodo() {
  if (!nodoSeleccionado.value) return
  error.value = ''
  try {
    const datos = {
      posX: nodoSeleccionado.value.posX,
      posY: nodoSeleccionado.value.posY,
    }
    if (!esNodoLigado(nodoSeleccionado.value)) {
      datos.etiqueta = edicionNodo.value.etiqueta.trim()
      datos.piso = edicionNodo.value.piso === '' ? null : Number(edicionNodo.value.piso)
      datos.pisoHasta = edicionNodo.value.pisoHasta === '' ? null : Number(edicionNodo.value.pisoHasta)
    }
    const actualizado = await api.actualizarNodoGrafo(nodoSeleccionado.value.id, datos, auth.token)
    Object.assign(nodoSeleccionado.value, actualizado)
    const idx = nodosFlow.value.findIndex((n) => n.id === String(nodoSeleccionado.value.id))
    if (idx !== -1) nodosFlow.value[idx] = nodoAFlow(nodoSeleccionado.value)
    deseleccionar()
  } catch (err) {
    error.value = err.message
  }
}

async function eliminarNodoSeleccionado() {
  if (!nodoSeleccionado.value) return
  const esLigado = esNodoLigado(nodoSeleccionado.value)
  const mensaje = esLigado
    ? `Esto solo quita "${textoNodo(nodoSeleccionado.value)}" del mapa; no borra el QR/Bloque/Espacio real. Volverá a aparecer si abres el grafo de nuevo. ¿Continuar?`
    : `¿Eliminar "${textoNodo(nodoSeleccionado.value)}" del mapa?`
  if (!confirm(mensaje)) return

  try {
    await api.eliminarNodoGrafo(nodoSeleccionado.value.id, auth.token)
    const id = nodoSeleccionado.value.id
    nodosOriginales.value = nodosOriginales.value.filter((n) => n.id !== id)
    nodosFlow.value = nodosFlow.value.filter((n) => n.id !== String(id))
    edgesOriginales.value = edgesOriginales.value.filter((e) => e.origenId !== id && e.destinoId !== id)
    edgesFlow.value = edgesFlow.value.filter((e) => e.source !== String(id) && e.target !== String(id))
    deseleccionar()
  } catch (err) {
    error.value = err.message
  }
}

async function eliminarEdgeSeleccionado() {
  if (!edgeSeleccionado.value) return
  if (!confirm('¿Eliminar esta conexión del mapa?')) return
  try {
    await api.eliminarEdgeGrafo(edgeSeleccionado.value.id, auth.token)
    const id = edgeSeleccionado.value.id
    edgesOriginales.value = edgesOriginales.value.filter((e) => e.id !== id)
    edgesFlow.value = edgesFlow.value.filter((e) => e.id !== String(id))
    deseleccionar()
  } catch (err) {
    error.value = err.message
  }
}

// --- Generar ruta automáticamente ---
const qrs = ref([])
const bloques = ref([])
const espacios = ref([])
const generarQrId = ref('')
const tipoDestino = ref('bloque')
const generarBloqueId = ref('')
const generarEspacioId = ref('')
const generando = ref(false)
const errorGenerar = ref('')
const pasosGenerados = ref([])
const caminoNodosUsados = ref([])
const caminoEdgesUsados = ref([])
const guardandoRuta = ref(false)
const mensajeGuardado = ref('')

async function cargarListasParaGenerador() {
  try {
    const [qrsData, bloquesData, espaciosData] = await Promise.all([
      api.listarQrs(auth.token),
      api.listarBloques(auth.token),
      api.buscarEspacios({}),
    ])
    qrs.value = qrsData
    bloques.value = bloquesData
    espacios.value = espaciosData.resultados
  } catch (err) {
    error.value = err.message
  }
}

function limpiarResaltado() {
  nodosFlow.value = nodosFlow.value.map((n) => ({
    ...n,
    class: n.class.filter((c) => c !== 'nodo-en-ruta'),
  }))
  edgesFlow.value = edgesFlow.value.map((e) => ({ ...e, animated: false, class: '' }))
}

function resaltarCamino(nodosUsados, edgesUsados) {
  const setNodos = new Set(nodosUsados)
  const setEdges = new Set(edgesUsados)
  nodosFlow.value = nodosFlow.value.map((n) => ({
    ...n,
    class: setNodos.has(Number(n.id)) ? [...n.class.filter((c) => c !== 'nodo-en-ruta'), 'nodo-en-ruta'] : n.class,
  }))
  edgesFlow.value = edgesFlow.value.map((e) =>
    setEdges.has(Number(e.id)) ? { ...e, animated: true, class: 'edge-en-ruta' } : { ...e, animated: false, class: '' },
  )
}

async function generar() {
  errorGenerar.value = ''
  mensajeGuardado.value = ''
  pasosGenerados.value = []
  if (!generarQrId.value || (tipoDestino.value === 'bloque' && !generarBloqueId.value)) return
  if (tipoDestino.value === 'espacio' && !generarEspacioId.value) return

  generando.value = true
  try {
    const resultado = await api.generarRutaDesdeGrafo(
      {
        qrId: generarQrId.value,
        bloqueId: tipoDestino.value === 'bloque' ? generarBloqueId.value : undefined,
        espacioId: tipoDestino.value === 'espacio' ? generarEspacioId.value : undefined,
      },
      auth.token,
    )
    pasosGenerados.value = resultado.instrucciones
    caminoNodosUsados.value = resultado.nodosUsados
    caminoEdgesUsados.value = resultado.edgesUsados
    resaltarCamino(resultado.nodosUsados, resultado.edgesUsados)
  } catch (err) {
    errorGenerar.value = err.message
    limpiarResaltado()
  } finally {
    generando.value = false
  }
}

function agregarPasoGenerado() {
  pasosGenerados.value.push('')
}

function quitarPasoGenerado(indice) {
  if (pasosGenerados.value.length > 1) pasosGenerados.value.splice(indice, 1)
}

async function guardarRutaGenerada() {
  const pasosLimpios = pasosGenerados.value.map((p) => p.trim()).filter(Boolean)
  if (pasosLimpios.length === 0) return

  const payloadBase = {
    qrId: generarQrId.value,
    bloqueId: tipoDestino.value === 'bloque' ? generarBloqueId.value : undefined,
    espacioId: tipoDestino.value === 'espacio' ? generarEspacioId.value : undefined,
    instrucciones: pasosLimpios,
    fotos: [],
    nodosGrafoUsados: caminoNodosUsados.value,
    edgesGrafoUsados: caminoEdgesUsados.value,
  }

  guardandoRuta.value = true
  errorGenerar.value = ''
  try {
    await api.crearRuta(payloadBase, auth.token)
    mensajeGuardado.value = 'Ruta guardada. Puedes verla y editarla en la pestaña Rutas.'
    pasosGenerados.value = []
    limpiarResaltado()
  } catch (err) {
    if (err.message.includes('Ya existe una ruta') && confirm('Ya existe una ruta para ese QR y ese destino. ¿Desea reemplazarla?')) {
      try {
        await api.crearRuta({ ...payloadBase, reemplazar: true }, auth.token)
        mensajeGuardado.value = 'Ruta reemplazada. Puedes verla y editarla en la pestaña Rutas.'
        pasosGenerados.value = []
        limpiarResaltado()
      } catch (err2) {
        errorGenerar.value = err2.message
      }
    } else if (!err.message.includes('Ya existe una ruta')) {
      errorGenerar.value = err.message
    }
  } finally {
    guardandoRuta.value = false
  }
}

onMounted(async () => {
  await cargarGrafo()
  await cargarListasParaGenerador()
  fitView()
})
</script>

<template>
  <div class="grafo-tab">
    <p class="ayuda">
      Arma el mapa del campus con nodos (QRs, bloques, espacios y puntos intermedios como pasillos o escaleras) y
      conéctalos arrastrando desde el borde de un nodo hasta otro. Esto no reemplaza las rutas manuales: es una forma
      opcional de generarlas automáticamente.
    </p>

    <form class="form-nuevo-nodo" @submit.prevent="agregarNodo">
      <select v-model="nuevoNodo.tipo">
        <option v-for="t in TIPOS_INTERMEDIOS" :key="t.valor" :value="t.valor">{{ t.etiqueta }}</option>
      </select>
      <input v-model="nuevoNodo.etiqueta" type="text" placeholder="Nombre, ej. Plaza Cervantes" required />
      <input v-model="nuevoNodo.piso" type="number" placeholder="Piso (opcional)" />
      <input
        v-if="esVertical"
        v-model="nuevoNodo.pisoHasta"
        type="number"
        placeholder="Piso hasta (ej. 3)"
      />
      <button type="submit" :disabled="creandoNodo">+ Agregar punto al mapa</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="cargando" class="estado">Cargando mapa…</div>

    <template v-else>
      <div class="leyenda">
        <span class="chip nodo-tipo-qr">QR</span>
        <span class="chip nodo-tipo-bloque">Bloque</span>
        <span class="chip nodo-tipo-espacio">Espacio</span>
        <span class="chip nodo-tipo-pasillo">Pasillo</span>
        <span class="chip nodo-tipo-escalera">Escalera</span>
        <span class="chip nodo-tipo-ascensor">Ascensor</span>
        <span class="chip nodo-tipo-puerta">Puerta</span>
        <span class="chip nodo-tipo-punto_referencia">Punto de referencia</span>
      </div>

      <div class="lienzo-wrap">
        <VueFlow
          v-model:nodes="nodosFlow"
          v-model:edges="edgesFlow"
          :default-viewport="{ zoom: 0.75 }"
          :min-zoom="0.2"
          :max-zoom="2"
          @node-drag-stop="onNodeDragStop"
          @connect="onConnect"
          @node-click="onNodeClick"
          @edge-click="onEdgeClick"
          @pane-click="deseleccionar"
        />
        <div class="controles-zoom">
          <button type="button" @click="zoomIn()">+</button>
          <button type="button" @click="zoomOut()">−</button>
          <button type="button" @click="fitView()">Encuadrar</button>
        </div>

        <div v-if="nodoSeleccionado" class="panel-lateral">
          <span class="panel-titulo">{{ nombreTipo(nodoSeleccionado.tipo) }}</span>
          <template v-if="esNodoLigado(nodoSeleccionado)">
            <p class="panel-info">{{ nodoSeleccionado.etiqueta }}</p>
            <p class="panel-nota">
              Este nodo viene de un {{ nombreTipo(nodoSeleccionado.tipo) }} ya existente; su nombre se administra
              desde la pestaña correspondiente, no aquí.
            </p>
          </template>
          <template v-else>
            <input v-model="edicionNodo.etiqueta" type="text" placeholder="Nombre" />
            <input v-model="edicionNodo.piso" type="number" placeholder="Piso" />
            <input
              v-if="nodoSeleccionado.tipo === 'ESCALERA' || nodoSeleccionado.tipo === 'ASCENSOR'"
              v-model="edicionNodo.pisoHasta"
              type="number"
              placeholder="Piso hasta"
            />
          </template>
          <div class="panel-acciones">
            <button v-if="!esNodoLigado(nodoSeleccionado)" class="btn-guardar" @click="guardarEdicionNodo">
              Guardar
            </button>
            <button class="btn-eliminar" @click="eliminarNodoSeleccionado">Eliminar del mapa</button>
            <button class="btn-cancelar" @click="deseleccionar">Cerrar</button>
          </div>
        </div>

        <div v-if="edgeSeleccionado" class="panel-lateral">
          <span class="panel-titulo">Conexión seleccionada</span>
          <div class="panel-acciones">
            <button class="btn-eliminar" @click="eliminarEdgeSeleccionado">Eliminar conexión</button>
            <button class="btn-cancelar" @click="deseleccionar">Cerrar</button>
          </div>
        </div>
      </div>
    </template>

    <div class="generador">
      <h3>Generar ruta automáticamente</h3>
      <p class="ayuda">
        Elige un QR de origen y un destino; el sistema calcula el camino más corto sobre el mapa y arma los pasos por
        ti. Puedes editarlos antes de guardar.
      </p>

      <div class="form-generador">
        <select v-model="generarQrId">
          <option value="" disabled>QR de origen…</option>
          <option v-for="qr in qrs" :key="qr.id" :value="qr.id">{{ qr.nombre }}</option>
        </select>

        <div class="tipo-destino">
          <label><input v-model="tipoDestino" type="radio" value="bloque" /> Bloque</label>
          <label><input v-model="tipoDestino" type="radio" value="espacio" /> Espacio</label>
        </div>

        <select v-if="tipoDestino === 'bloque'" v-model="generarBloqueId">
          <option value="" disabled>Bloque de destino…</option>
          <option v-for="bloque in bloques" :key="bloque.id" :value="bloque.id">{{ bloque.nombre }}</option>
        </select>
        <select v-else v-model="generarEspacioId">
          <option value="" disabled>Espacio de destino…</option>
          <option v-for="espacio in espacios" :key="espacio.id" :value="espacio.id">
            {{ espacio.nombre }} — {{ espacio.bloque?.nombre }}
          </option>
        </select>

        <button type="button" :disabled="generando" @click="generar">
          {{ generando ? 'Calculando…' : 'Generar camino' }}
        </button>
      </div>

      <p v-if="errorGenerar" class="error">{{ errorGenerar }}</p>
      <p v-if="mensajeGuardado" class="mensaje-ok">{{ mensajeGuardado }}</p>

      <div v-if="pasosGenerados.length" class="pasos-generados">
        <p class="titulo-fotos">Pasos generados (edítalos si algo no queda bien):</p>
        <div v-for="(paso, i) in pasosGenerados" :key="i" class="fila-paso">
          <span class="numero-paso">{{ i + 1 }}</span>
          <input v-model="pasosGenerados[i]" type="text" />
          <button
            v-if="pasosGenerados.length > 1"
            type="button"
            class="btn-quitar-paso"
            @click="quitarPasoGenerado(i)"
          >
            ✕
          </button>
        </div>
        <button type="button" class="btn-agregar-paso" @click="agregarPasoGenerado">+ Agregar instrucción</button>
        <button type="button" class="btn-guardar-ruta" :disabled="guardandoRuta" @click="guardarRutaGenerada">
          {{ guardandoRuta ? 'Guardando…' : 'Guardar ruta' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grafo-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ayuda {
  font-size: 0.85rem;
  color: var(--ng-ink-soft);
  line-height: 1.45;
}

.form-nuevo-nodo {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.form-nuevo-nodo select,
.form-nuevo-nodo input {
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.88rem;
  font-family: inherit;
}

.form-nuevo-nodo input[type='number'] {
  width: 9rem;
}

.form-nuevo-nodo button[type='submit'] {
  padding: 0.55rem 1rem;
  background: var(--ng-navy);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.88rem;
}

.error {
  color: var(--ng-danger);
}

.mensaje-ok {
  color: var(--ng-navy);
  font-weight: 600;
  font-size: 0.88rem;
}

.estado {
  color: var(--ng-ink-soft);
}

.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  color: white;
}

.lienzo-wrap {
  position: relative;
  height: 480px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--ng-cream-mute);
}

.controles-zoom {
  position: absolute;
  bottom: 0.6rem;
  left: 0.6rem;
  display: flex;
  gap: 0.3rem;
  z-index: 5;
}

.controles-zoom button {
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: white;
  cursor: pointer;
  font-size: 0.85rem;
}

.panel-lateral {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  width: 220px;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 5;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

.panel-titulo {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--ng-navy);
}

.panel-info {
  font-size: 0.85rem;
}

.panel-nota {
  font-size: 0.72rem;
  color: var(--ng-ink-soft);
}

.panel-lateral input {
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.82rem;
}

.panel-acciones {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.panel-acciones button {
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  font-size: 0.78rem;
  cursor: pointer;
}

.btn-guardar,
.btn-guardar-ruta {
  background: var(--ng-navy);
  color: white;
  border: none;
}

.btn-eliminar {
  background: white;
  border: 1px solid var(--ng-danger);
  color: var(--ng-danger);
}

.btn-cancelar {
  background: none;
  border: 1px solid var(--color-border);
}

.generador {
  padding: 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.generador h3 {
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--ng-navy);
}

.form-generador {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.form-generador select {
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.88rem;
  font-family: inherit;
}

.tipo-destino {
  display: flex;
  gap: 0.75rem;
  font-size: 0.85rem;
}

.form-generador button {
  padding: 0.55rem 1rem;
  background: var(--ng-navy);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.88rem;
}

.pasos-generados {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 0.4rem;
  border-top: 1px dashed var(--color-border);
}

.titulo-fotos {
  font-size: 0.78rem;
  color: var(--ng-ink-soft);
}

.fila-paso {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.numero-paso {
  flex-shrink: 0;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: var(--ng-navy);
  color: white;
  font-size: 0.72rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fila-paso input {
  flex: 1;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.88rem;
}

.btn-quitar-paso {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--ng-danger);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.2rem 0.4rem;
}

.btn-agregar-paso {
  align-self: flex-start;
  padding: 0.35rem 0.7rem;
  background: var(--ng-accent-light);
  color: var(--ng-navy);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
}

.btn-guardar-ruta {
  align-self: flex-start;
  margin-top: 0.3rem;
}

/* --- Colores por tipo de nodo (afecta al DOM interno de VueFlow) --- */
.lienzo-wrap :deep(.vue-flow__node) {
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 600;
  text-align: center;
  padding: 0.3rem 0.5rem;
  border-width: 2px;
  border-style: solid;
}

.lienzo-wrap :deep(.nodo-tipo-qr) {
  background: #1f2a24;
  color: white;
  border-color: #1f2a24;
}
.lienzo-wrap :deep(.nodo-tipo-bloque) {
  background: #0f6a4e;
  color: white;
  border-color: #0f6a4e;
}
.lienzo-wrap :deep(.nodo-tipo-espacio) {
  background: #e1f3e9;
  color: #0f6a4e;
  border-color: #0f6a4e;
}
.lienzo-wrap :deep(.nodo-tipo-pasillo) {
  background: white;
  color: #1f2a24;
  border-color: rgba(31, 42, 36, 0.3);
}
.lienzo-wrap :deep(.nodo-tipo-escalera) {
  background: #ffe3d2;
  color: #c1440e;
  border-color: #c1440e;
}
.lienzo-wrap :deep(.nodo-tipo-ascensor) {
  background: #ffe3d2;
  color: #c1440e;
  border-color: #c1440e;
}
.lienzo-wrap :deep(.nodo-tipo-puerta) {
  background: #fff6da;
  color: #8a6d00;
  border-color: #d8b400;
}
.lienzo-wrap :deep(.nodo-tipo-punto_referencia) {
  background: #f0f0ee;
  color: #1f2a24;
  border-color: rgba(31, 42, 36, 0.3);
}

.lienzo-wrap :deep(.nodo-en-ruta) {
  box-shadow: 0 0 0 3px #0f6a4e;
}

.lienzo-wrap :deep(.edge-en-ruta path) {
  stroke: #0f6a4e;
  stroke-width: 2.5;
}

.chip.nodo-tipo-qr {
  background: #1f2a24;
}
.chip.nodo-tipo-bloque {
  background: #0f6a4e;
}
.chip.nodo-tipo-espacio {
  background: #0f6a4e;
  opacity: 0.7;
}
.chip.nodo-tipo-pasillo {
  background: #6b6b6b;
}
.chip.nodo-tipo-escalera,
.chip.nodo-tipo-ascensor {
  background: #c1440e;
}
.chip.nodo-tipo-puerta {
  background: #d8b400;
}
.chip.nodo-tipo-punto_referencia {
  background: #8a8a8a;
}
</style>
