<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { api } from '../../lib/api'

const auth = useAuthStore()
const espacios = ref([])
const bloques = ref([])
const rutas = ref([])
const cargando = ref(true)
const error = ref('')

const TIPOS = ['SALON', 'OFICINA', 'LABORATORIO', 'CAFETERIA', 'BANO', 'OTRO']

const vacio = () => ({ nombre: '', tipo: 'SALON', piso: 1, bloqueId: '', instruccionFinal: '', fotos: [] })
const nuevoEspacio = ref(vacio())
const creando = ref(false)

const editandoId = ref(null)
const edicion = ref(vacio())

// Borradores de pasos que se están editando inline (rutaId -> array de pasos).
const borradoresRuta = ref({})
const guardandoRutaId = ref(null)

function rutasDelBloque(bloqueId) {
  return rutas.value.filter((r) => r.bloqueId === bloqueId)
}

function agregarFotoEspacio(lista) {
  lista.push('')
}

function quitarFotoEspacio(lista, indice) {
  lista.splice(indice, 1)
}

// Referencia a qué lista (nueva o edición) recibe la foto que se está subiendo.
const listaFotoObjetivo = ref(null)
const subiendoFoto = ref(false)
const inputArchivoFoto = ref(null)

function abrirSelectorArchivo(lista) {
  listaFotoObjetivo.value = lista
  inputArchivoFoto.value.click()
}

async function onArchivoSeleccionado(evento) {
  const archivo = evento.target.files[0]
  evento.target.value = '' // permite volver a elegir el mismo archivo después
  if (!archivo || !listaFotoObjetivo.value) return

  subiendoFoto.value = true
  error.value = ''
  try {
    const url = await api.subirFoto(archivo, auth.token)
    listaFotoObjetivo.value.push(url)
  } catch (err) {
    error.value = err.message
  } finally {
    subiendoFoto.value = false
  }
}

// --- Crear varios espacios de una vez (por rango de números) ---
const NOMBRE_BASE = {
  SALON: 'Salón',
  OFICINA: 'Oficina',
  LABORATORIO: 'Laboratorio',
  CAFETERIA: 'Cafetería',
  BANO: 'Baño',
  OTRO: 'Espacio',
}
const loteAbierto = ref(false)
const lote = ref({ bloqueId: '', piso: '', tipo: 'SALON', prefijo: '', desde: '', hasta: '' })
const creandoLote = ref(false)
const mensajeLote = ref('')

// "Bloque A" -> "A". Si el nombre del bloque no termina en una sigla corta
// (ej. "Bloque Central"), el prefijo queda vacío para que lo escribas tú.
function letraDelBloque(nombre) {
  const ultima = (nombre || '').trim().split(/\s+/).pop() || ''
  return ultima.length <= 2 ? ultima.toUpperCase() : ''
}

watch(
  () => lote.value.bloqueId,
  (id) => {
    const bloque = bloques.value.find((b) => b.id === Number(id))
    lote.value.prefijo = bloque ? letraDelBloque(bloque.nombre) : ''
  },
)

const vistaPreviaLote = computed(() => {
  const { bloqueId, tipo, prefijo, desde, hasta } = lote.value
  if (!bloqueId || desde === '' || hasta === '') return null
  const inicio = Number(desde)
  const fin = Number(hasta)
  if (!Number.isInteger(inicio) || !Number.isInteger(fin) || fin < inicio) {
    return { error: '"Hasta" debe ser un número igual o mayor que "Desde".' }
  }
  if (fin - inicio + 1 > 200) return { error: 'Máximo 200 espacios por lote.' }

  const existentes = new Set(
    espacios.value.filter((e) => e.bloqueId === Number(bloqueId)).map((e) => e.nombre.trim().toLowerCase()),
  )
  const items = []
  for (let n = inicio; n <= fin; n += 1) {
    const nombre = `${NOMBRE_BASE[tipo]} ${prefijo.trim()}${n}`
    items.push({ nombre, existe: existentes.has(nombre.toLowerCase()) })
  }
  return { items, nuevos: items.filter((i) => !i.existe).length }
})

async function crearLote() {
  const vista = vistaPreviaLote.value
  if (!vista?.items || vista.nuevos === 0 || lote.value.piso === '') return
  creandoLote.value = true
  error.value = ''
  mensajeLote.value = ''
  try {
    const resultado = await api.crearEspaciosLote(
      {
        bloqueId: Number(lote.value.bloqueId),
        piso: Number(lote.value.piso),
        tipo: lote.value.tipo,
        prefijo: lote.value.prefijo,
        desde: Number(lote.value.desde),
        hasta: Number(lote.value.hasta),
      },
      auth.token,
    )
    mensajeLote.value =
      `Se crearon ${resultado.creados.length} espacio(s).` +
      (resultado.omitidos.length ? ` Se saltaron ${resultado.omitidos.length} que ya existían.` : '')
    lote.value.desde = ''
    lote.value.hasta = ''
    await cargar()
  } catch (err) {
    error.value = err.message
  } finally {
    creandoLote.value = false
  }
}

async function cargar() {
  cargando.value = true
  try {
    const [data, bloquesData, rutasData] = await Promise.all([
      api.buscarEspacios({}),
      api.listarBloques(auth.token),
      api.listarRutas(auth.token),
    ])
    espacios.value = data.resultados
    bloques.value = bloquesData
    rutas.value = rutasData
  } catch (err) {
    error.value = err.message
  } finally {
    cargando.value = false
  }
}

function pasosRuta(ruta) {
  if (!borradoresRuta.value[ruta.id]) {
    borradoresRuta.value[ruta.id] = [...ruta.instrucciones]
  }
  return borradoresRuta.value[ruta.id]
}

function agregarPaso(ruta) {
  pasosRuta(ruta).push('')
}

function quitarPaso(ruta, indice) {
  const pasos = pasosRuta(ruta)
  if (pasos.length > 1) pasos.splice(indice, 1)
}

async function guardarRuta(ruta) {
  const pasosLimpios = pasosRuta(ruta).map((p) => p.trim()).filter(Boolean)
  if (pasosLimpios.length === 0) return
  guardandoRutaId.value = ruta.id
  try {
    await api.actualizarRuta(ruta.id, pasosLimpios, ruta.fotos || [], auth.token)
    delete borradoresRuta.value[ruta.id]
    await cargar()
  } catch (err) {
    error.value = err.message
  } finally {
    guardandoRutaId.value = null
  }
}

async function crear() {
  const e = nuevoEspacio.value
  if (!e.nombre.trim() || !e.bloqueId || !e.instruccionFinal.trim()) return
  creando.value = true
  error.value = ''
  try {
    await api.crearEspacio(e, auth.token)
    nuevoEspacio.value = vacio()
    await cargar()
  } catch (err) {
    error.value = err.message
  } finally {
    creando.value = false
  }
}

function empezarEdicion(espacio) {
  error.value = ''
  editandoId.value = espacio.id
  edicion.value = {
    nombre: espacio.nombre,
    tipo: espacio.tipo,
    piso: espacio.piso,
    bloqueId: espacio.bloqueId,
    instruccionFinal: espacio.instruccionFinal,
    fotos: [...(espacio.fotos || [])],
  }
}

async function guardarEdicion(espacio) {
  try {
    await api.actualizarEspacio(espacio.id, edicion.value, auth.token)
    editandoId.value = null
    await cargar()
  } catch (err) {
    error.value = err.message
  }
}

async function eliminar(espacio) {
  const confirmado = confirm(`¿Eliminar "${espacio.nombre}"?`)
  if (!confirmado) return
  try {
    await api.eliminarEspacio(espacio.id, auth.token)
    await cargar()
  } catch (err) {
    error.value = err.message
  }
}

onMounted(cargar)
</script>

<template>
  <div>
    <div class="lote">
      <button v-if="!loteAbierto" type="button" class="btn-lote" @click="loteAbierto = true">
        + Crear varios espacios (por rango)
      </button>

      <form v-else class="form-lote" @submit.prevent="crearLote">
        <h3>Crear varios espacios</h3>
        <p class="ayuda-lote">
          Elige bloque, piso y tipo, y el rango de números. Ejemplo: bloque A, piso 2, del 201 al 215 crea "Salón
          A201" hasta "Salón A215". Los que ya existan en ese bloque se saltan. Un piso por rango.
        </p>
        <div class="fila-form">
          <select v-model="lote.bloqueId" required>
            <option value="" disabled>Bloque…</option>
            <option v-for="b in bloques" :key="b.id" :value="b.id">{{ b.nombre }}</option>
          </select>
          <input v-model.number="lote.piso" type="number" placeholder="Piso" required />
          <select v-model="lote.tipo">
            <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="fila-form">
          <input v-model="lote.prefijo" type="text" maxlength="6" placeholder="Prefijo, ej. A" />
          <input v-model.number="lote.desde" type="number" min="0" placeholder="Desde, ej. 201" required />
          <input v-model.number="lote.hasta" type="number" min="0" placeholder="Hasta, ej. 215" required />
        </div>

        <div v-if="vistaPreviaLote?.items" class="previa-lote">
          <span class="resumen-lote">
            Se crearán {{ vistaPreviaLote.nuevos }}
            <template v-if="vistaPreviaLote.items.length - vistaPreviaLote.nuevos">
              · {{ vistaPreviaLote.items.length - vistaPreviaLote.nuevos }} ya existen y se saltan
            </template>
          </span>
          <div class="chips-lote">
            <span
              v-for="item in vistaPreviaLote.items.slice(0, 60)"
              :key="item.nombre"
              class="chip-lote"
              :class="{ 'chip-lote--existe': item.existe }"
            >
              {{ item.nombre }}
            </span>
            <span v-if="vistaPreviaLote.items.length > 60" class="chip-lote chip-lote--mas">
              …y {{ vistaPreviaLote.items.length - 60 }} más
            </span>
          </div>
        </div>
        <p v-else-if="vistaPreviaLote?.error" class="error">{{ vistaPreviaLote.error }}</p>

        <p class="ayuda-lote">
          Cada espacio se crea con la instrucción final "Piso N, nombre"; puedes editarla después, uno por uno.
        </p>

        <div class="acciones-lote">
          <button
            type="submit"
            :disabled="creandoLote || !vistaPreviaLote?.items || vistaPreviaLote.nuevos === 0 || lote.piso === ''"
          >
            {{ creandoLote ? 'Creando…' : `Crear ${vistaPreviaLote?.nuevos ?? 0} espacio(s)` }}
          </button>
          <button type="button" class="btn-cerrar-lote" @click="loteAbierto = false">Cerrar</button>
        </div>
        <p v-if="mensajeLote" class="exito-lote">{{ mensajeLote }}</p>
      </form>
    </div>

    <form class="form-nuevo" @submit.prevent="crear">
      <div class="fila-form">
        <input v-model="nuevoEspacio.nombre" type="text" placeholder="Nombre, ej. D105" />
        <select v-model="nuevoEspacio.tipo">
          <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
        </select>
        <input v-model.number="nuevoEspacio.piso" type="number" placeholder="Piso" />
      </div>
      <div class="fila-form">
        <select v-model="nuevoEspacio.bloqueId">
          <option value="" disabled>Bloque…</option>
          <option v-for="b in bloques" :key="b.id" :value="b.id">{{ b.nombre }}</option>
        </select>
        <input
          v-model="nuevoEspacio.instruccionFinal"
          type="text"
          placeholder="Instrucción final, ej. Primer piso, segunda puerta"
        />
      </div>

      <div class="fotos-form">
        <span class="titulo-fotos">Fotos del espacio (opcional)</span>
        <div class="miniaturas">
          <div v-for="(foto, i) in nuevoEspacio.fotos" :key="i" class="miniatura">
            <img :src="foto" alt="" />
            <button type="button" class="btn-quitar-mini" @click="quitarFotoEspacio(nuevoEspacio.fotos, i)">✕</button>
          </div>
        </div>
        <button
          type="button"
          class="btn-agregar-foto"
          :disabled="subiendoFoto"
          @click="abrirSelectorArchivo(nuevoEspacio.fotos)"
        >
          {{ subiendoFoto ? 'Subiendo…' : '+ Subir foto desde el computador' }}
        </button>
      </div>

      <button type="submit" :disabled="creando">Agregar espacio</button>

      <div v-if="nuevoEspacio.bloqueId" class="seccion-rutas">
        <p class="titulo-rutas">Ruta(s) hacia este bloque</p>
        <p v-if="rutasDelBloque(nuevoEspacio.bloqueId).length === 0" class="sin-rutas">
          Este bloque todavía no tiene ninguna ruta cargada (créala en la pestaña "Rutas").
        </p>
        <div v-for="ruta in rutasDelBloque(nuevoEspacio.bloqueId)" :key="ruta.id" class="ruta-editable">
          <span class="ruta-origen">Desde: {{ ruta.qr.nombre }}</span>
          <div v-for="(paso, i) in pasosRuta(ruta)" :key="i" class="fila-paso-ruta">
            <span class="numero-paso">{{ i + 1 }}</span>
            <input v-model="pasosRuta(ruta)[i]" type="text" />
            <button
              v-if="pasosRuta(ruta).length > 1"
              type="button"
              class="btn-quitar-paso"
              @click="quitarPaso(ruta, i)"
            >
              ✕
            </button>
          </div>
          <button type="button" class="btn-agregar-paso" @click="agregarPaso(ruta)">
            + Agregar instrucción
          </button>
          <button
            class="btn-guardar-ruta"
            :disabled="guardandoRutaId === ruta.id"
            @click="guardarRuta(ruta)"
          >
            {{ guardandoRutaId === ruta.id ? 'Guardando…' : 'Guardar ruta' }}
          </button>
        </div>
      </div>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="cargando" class="estado">Cargando espacios…</div>

    <ul v-else class="lista">
      <li v-for="espacio in espacios" :key="espacio.id" class="fila">
        <div v-if="editandoId === espacio.id" class="edicion">
          <div class="fila-form">
            <input v-model="edicion.nombre" type="text" />
            <select v-model="edicion.tipo">
              <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
            </select>
            <input v-model.number="edicion.piso" type="number" />
          </div>
          <div class="fila-form">
            <select v-model="edicion.bloqueId">
              <option v-for="b in bloques" :key="b.id" :value="b.id">{{ b.nombre }}</option>
            </select>
            <input v-model="edicion.instruccionFinal" type="text" />
          </div>

          <div class="fotos-form">
            <span class="titulo-fotos">Fotos del espacio</span>
            <div class="miniaturas">
              <div v-for="(foto, i) in edicion.fotos" :key="i" class="miniatura">
                <img :src="foto" alt="" />
                <button type="button" class="btn-quitar-mini" @click="quitarFotoEspacio(edicion.fotos, i)">✕</button>
              </div>
            </div>
            <button
              type="button"
              class="btn-agregar-foto"
              :disabled="subiendoFoto"
              @click="abrirSelectorArchivo(edicion.fotos)"
            >
              {{ subiendoFoto ? 'Subiendo…' : '+ Subir foto desde el computador' }}
            </button>
          </div>

          <div class="botones-edicion">
            <button class="btn-guardar" @click="guardarEdicion(espacio)">Guardar</button>
            <button class="btn-cancelar" @click="editandoId = null">Cancelar</button>
          </div>

          <div v-if="edicion.bloqueId" class="seccion-rutas">
            <p class="titulo-rutas">Ruta(s) hacia este bloque</p>
            <p v-if="rutasDelBloque(edicion.bloqueId).length === 0" class="sin-rutas">
              Este bloque todavía no tiene ninguna ruta cargada.
            </p>
            <div v-for="ruta in rutasDelBloque(edicion.bloqueId)" :key="ruta.id" class="ruta-editable">
              <span class="ruta-origen">Desde: {{ ruta.qr.nombre }}</span>
              <div v-for="(paso, i) in pasosRuta(ruta)" :key="i" class="fila-paso-ruta">
                <span class="numero-paso">{{ i + 1 }}</span>
                <input v-model="pasosRuta(ruta)[i]" type="text" />
                <button
                  v-if="pasosRuta(ruta).length > 1"
                  type="button"
                  class="btn-quitar-paso"
                  @click="quitarPaso(ruta, i)"
                >
                  ✕
                </button>
              </div>
              <button type="button" class="btn-agregar-paso" @click="agregarPaso(ruta)">
                + Agregar instrucción
              </button>
              <button
                class="btn-guardar-ruta"
                :disabled="guardandoRutaId === ruta.id"
                @click="guardarRuta(ruta)"
              >
                {{ guardandoRutaId === ruta.id ? 'Guardando…' : 'Guardar ruta' }}
              </button>
            </div>
          </div>
        </div>
        <template v-else>
          <div class="info">
            <span class="codigo">{{ espacio.nombre }}</span>
            <span class="detalle">
              {{ espacio.bloque.nombre }} · Piso {{ espacio.piso }} · {{ espacio.tipo }}
            </span>
          </div>
          <div class="acciones">
            <button class="btn-editar" @click="empezarEdicion(espacio)">Editar</button>
            <button class="btn-eliminar" @click="eliminar(espacio)">Eliminar</button>
          </div>
        </template>
      </li>
    </ul>

    <input
      ref="inputArchivoFoto"
      type="file"
      accept="image/*"
      class="input-archivo-oculto"
      @change="onArchivoSeleccionado"
    />
  </div>
</template>

<style scoped>
.lote {
  margin-bottom: 1rem;
}

.btn-lote {
  padding: 0.55rem 1rem;
  background: var(--ng-accent-light);
  color: var(--ng-navy);
  border: none;
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.form-lote {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.form-lote h3 {
  font-family: var(--font-display);
  font-size: 0.95rem;
  color: var(--ng-navy);
}

.ayuda-lote {
  font-size: 0.78rem;
  color: var(--ng-ink-soft);
  line-height: 1.45;
}

.form-lote select,
.form-lote input {
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.88rem;
  font-family: inherit;
}

.previa-lote {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem 0.7rem;
  background: var(--ng-cream);
  border-radius: 8px;
}

.resumen-lote {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ng-navy);
}

.chips-lote {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.chip-lote {
  font-size: 0.72rem;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  background: var(--ng-accent-light);
  color: var(--ng-navy);
}

.chip-lote--existe {
  background: var(--ng-cream-mute);
  color: var(--ng-ink-soft);
  text-decoration: line-through;
}

.chip-lote--mas {
  background: none;
  color: var(--ng-ink-soft);
}

.acciones-lote {
  display: flex;
  gap: 0.5rem;
}

.acciones-lote button[type='submit'] {
  padding: 0.55rem 1rem;
  background: var(--ng-navy);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.88rem;
}

.acciones-lote button[type='submit']:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-cerrar-lote {
  padding: 0.55rem 1rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.88rem;
}

.exito-lote {
  color: var(--ng-navy);
  font-weight: 600;
  font-size: 0.85rem;
}

.form-nuevo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  padding: 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.fila-form {
  display: flex;
  gap: 0.5rem;
}

.fila-form input,
.fila-form select {
  flex: 1;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.88rem;
  min-width: 0;
}

.form-nuevo > button {
  padding: 0.6rem 1.1rem;
  background: var(--ng-navy);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.fotos-form {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.titulo-fotos {
  font-size: 0.78rem;
  color: var(--ng-ink-soft);
}

.miniaturas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.miniatura {
  position: relative;
  width: 70px;
  height: 70px;
}

.miniatura img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.btn-quitar-mini {
  position: absolute;
  top: -0.35rem;
  right: -0.35rem;
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 50%;
  background: var(--ng-danger);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 0.65rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.input-archivo-oculto {
  display: none;
}

.btn-agregar-foto {
  align-self: flex-start;
  padding: 0.3rem 0.6rem;
  background: white;
  border: 1px dashed var(--ng-navy);
  color: var(--ng-navy);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 600;
}

.error {
  color: var(--ng-danger);
  margin-bottom: 1rem;
}

.estado {
  color: var(--ng-ink-soft);
}

.lista {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.fila {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  flex-wrap: wrap;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.codigo {
  font-weight: 600;
  background: var(--ng-navy);
  color: white;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  width: fit-content;
}

.detalle {
  font-size: 0.78rem;
  color: var(--ng-ink-soft);
}

.acciones {
  display: flex;
  gap: 0.4rem;
}

.btn-editar,
.btn-eliminar,
.btn-guardar,
.btn-cancelar {
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-editar {
  background: white;
  border: 1px solid var(--ng-navy);
  color: var(--ng-navy);
}

.btn-eliminar {
  background: white;
  border: 1px solid var(--ng-danger);
  color: var(--ng-danger);
}

.btn-guardar {
  background: var(--ng-navy);
  color: white;
  border: none;
}

.btn-cancelar {
  background: none;
  border: 1px solid var(--color-border);
}

.edicion {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.botones-edicion {
  display: flex;
  gap: 0.4rem;
}

.seccion-rutas {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.titulo-rutas {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ng-ink-soft);
}

.sin-rutas {
  font-size: 0.8rem;
  color: var(--ng-ink-soft);
  font-style: italic;
}

.ruta-editable {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.6rem;
  background: var(--ng-accent-light);
  border-radius: 6px;
}

.ruta-origen {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ng-navy);
}

.fila-paso-ruta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.numero-paso {
  flex-shrink: 0;
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 50%;
  background: var(--ng-navy);
  color: white;
  font-size: 0.68rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fila-paso-ruta input {
  flex: 1;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.82rem;
}

.btn-quitar-paso {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--ng-danger);
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-agregar-paso {
  align-self: flex-start;
  padding: 0.3rem 0.6rem;
  background: white;
  border: 1px dashed var(--ng-navy);
  color: var(--ng-navy);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 600;
}

.btn-guardar-ruta {
  align-self: flex-start;
  padding: 0.35rem 0.7rem;
  background: var(--ng-navy);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.78rem;
}

.btn-guardar-ruta:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
