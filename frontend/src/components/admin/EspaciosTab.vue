<script setup>
import { ref, computed, onMounted } from 'vue'
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
