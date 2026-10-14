<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { api } from '../../lib/api'
import CampoImagen from './CampoImagen.vue'

const auth = useAuthStore()
const eventos = ref([])
const espacios = ref([])
const cargando = ref(true)
const error = ref('')
const guardando = ref(false)

// --- Utilidades de fecha ---
// El <input type="datetime-local"> trabaja en hora local del navegador;
// el backend guarda en UTC (ISO). Estas dos funciones convierten.
function aInputLocal(iso) {
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function aIso(local) {
  return new Date(local).toISOString()
}

function formatear(iso) {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

function estadoDe(item) {
  if (!item.visible) return { clave: 'oculto', texto: 'Oculto' }
  const ahora = Date.now()
  if (ahora < new Date(item.inicio).getTime()) return { clave: 'programado', texto: 'Programado' }
  if (ahora > new Date(item.fin).getTime()) return { clave: 'terminado', texto: 'Terminado' }
  return { clave: 'en-curso', texto: 'En curso' }
}

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [listaEventos, datosEspacios] = await Promise.all([
      api.listarEventos(auth.token),
      api.buscarEspacios({}),
    ])
    eventos.value = listaEventos
    espacios.value = datosEspacios.resultados
  } catch (err) {
    error.value = err.message
  } finally {
    cargando.value = false
  }
}

// --- Formulario de evento (crear y editar comparten el mismo) ---
const vacioEvento = () => ({ id: null, nombre: '', descripcion: '', imagen: '', inicio: '', fin: '', visible: true })
const formEvento = ref(null) // null = cerrado

function abrirFormEvento(evento) {
  formEvento.value = evento
    ? {
        id: evento.id,
        nombre: evento.nombre,
        descripcion: evento.descripcion,
        imagen: evento.imagen || '',
        inicio: aInputLocal(evento.inicio),
        fin: aInputLocal(evento.fin),
        visible: evento.visible,
      }
    : vacioEvento()
}

async function guardarEvento() {
  const f = formEvento.value
  if (!f.nombre.trim() || !f.inicio || !f.fin) return
  guardando.value = true
  error.value = ''
  const datos = {
    nombre: f.nombre,
    descripcion: f.descripcion,
    imagen: f.imagen || null,
    inicio: aIso(f.inicio),
    fin: aIso(f.fin),
    visible: f.visible,
  }
  try {
    if (f.id) await api.actualizarEvento(f.id, datos, auth.token)
    else await api.crearEvento(datos, auth.token)
    formEvento.value = null
    await cargar()
  } catch (err) {
    error.value = err.message
  } finally {
    guardando.value = false
  }
}

async function alternarVisibleEvento(evento) {
  error.value = ''
  try {
    await api.actualizarEvento(evento.id, { visible: !evento.visible }, auth.token)
    await cargar()
  } catch (err) {
    error.value = err.message
  }
}

async function eliminarEvento(evento) {
  const total = evento.subEventos.length
  const aviso = total
    ? `¿Eliminar "${evento.nombre}" y sus ${total} sub-evento(s)? No se puede deshacer.`
    : `¿Eliminar "${evento.nombre}"? No se puede deshacer.`
  if (!confirm(aviso)) return
  error.value = ''
  try {
    await api.eliminarEvento(evento.id, auth.token)
    await cargar()
  } catch (err) {
    error.value = err.message
  }
}

// --- Formulario de sub-evento (uno a la vez, dentro de su evento) ---
const formSub = ref(null) // { id|null, eventoId, ... } o null

function abrirFormSub(evento, sub) {
  formSub.value = sub
    ? {
        id: sub.id,
        eventoId: evento.id,
        nombre: sub.nombre,
        descripcion: sub.descripcion,
        imagen: sub.imagen || '',
        inicio: aInputLocal(sub.inicio),
        fin: aInputLocal(sub.fin),
        espacioId: sub.espacioId ?? '',
        visible: sub.visible,
      }
    : {
        id: null,
        eventoId: evento.id,
        nombre: '',
        descripcion: '',
        imagen: '',
        // Por comodidad, arranca con el horario del evento padre.
        inicio: aInputLocal(evento.inicio),
        fin: aInputLocal(evento.fin),
        espacioId: '',
        visible: true,
      }
}

async function guardarSub() {
  const f = formSub.value
  if (!f.nombre.trim() || !f.inicio || !f.fin || !f.espacioId) return
  guardando.value = true
  error.value = ''
  const datos = {
    nombre: f.nombre,
    descripcion: f.descripcion,
    imagen: f.imagen || null,
    inicio: aIso(f.inicio),
    fin: aIso(f.fin),
    espacioId: Number(f.espacioId),
    visible: f.visible,
  }
  try {
    if (f.id) await api.actualizarSubEvento(f.id, datos, auth.token)
    else await api.crearSubEvento(f.eventoId, datos, auth.token)
    formSub.value = null
    await cargar()
  } catch (err) {
    error.value = err.message
  } finally {
    guardando.value = false
  }
}

async function alternarVisibleSub(sub) {
  error.value = ''
  try {
    await api.actualizarSubEvento(sub.id, { visible: !sub.visible }, auth.token)
    await cargar()
  } catch (err) {
    error.value = err.message
  }
}

async function eliminarSub(sub) {
  if (!confirm(`¿Eliminar el sub-evento "${sub.nombre}"?`)) return
  error.value = ''
  try {
    await api.eliminarSubEvento(sub.id, auth.token)
    await cargar()
  } catch (err) {
    error.value = err.message
  }
}

onMounted(cargar)
</script>

<template>
  <div class="eventos-tab">
    <p class="ayuda">
      Los eventos aparecen en una burbuja en la pantalla de Inicio de la app, solo mientras están en curso (entre su
      inicio y su fin) y siempre que estén visibles. Cada sub-evento se realiza en un espacio ya registrado, y si
      desde el QR de la persona existe una ruta hasta ese espacio, se le ofrece el botón "Cómo llegar".
    </p>

    <p v-if="error" class="error">{{ error }}</p>

    <button v-if="!formEvento" class="btn-principal" @click="abrirFormEvento()">+ Nuevo evento</button>

    <form v-if="formEvento" class="form-tarjeta" @submit.prevent="guardarEvento">
      <h3>{{ formEvento.id ? 'Editar evento' : 'Nuevo evento' }}</h3>
      <input
        v-model="formEvento.nombre"
        type="text"
        placeholder="Nombre, ej. Día de la Ingeniería Multimedia"
        required
      />
      <textarea v-model="formEvento.descripcion" rows="2" placeholder="Descripción corta (opcional)"></textarea>
      <div class="fila-fechas">
        <label>Inicio <input v-model="formEvento.inicio" type="datetime-local" required /></label>
        <label>Fin <input v-model="formEvento.fin" type="datetime-local" required /></label>
      </div>
      <CampoImagen v-model="formEvento.imagen" />
      <label class="check"><input v-model="formEvento.visible" type="checkbox" /> Visible en la app</label>
      <div class="acciones-form">
        <button type="submit" class="btn-principal" :disabled="guardando">Guardar evento</button>
        <button type="button" class="btn-secundario" @click="formEvento = null">Cancelar</button>
      </div>
    </form>

    <div v-if="cargando" class="estado">Cargando eventos…</div>
    <p v-else-if="eventos.length === 0 && !formEvento" class="estado">Todavía no hay eventos.</p>

    <ul v-else class="lista">
      <li v-for="evento in eventos" :key="evento.id" class="tarjeta">
        <div class="cabecera">
          <img v-if="evento.imagen" :src="evento.imagen" alt="" class="miniatura" />
          <div class="info">
            <div class="titulo-fila">
              <span class="nombre">{{ evento.nombre }}</span>
              <span class="estado-chip" :class="`estado-chip--${estadoDe(evento).clave}`">
                {{ estadoDe(evento).texto }}
              </span>
            </div>
            <span class="fechas">{{ formatear(evento.inicio) }} → {{ formatear(evento.fin) }}</span>
            <p v-if="evento.descripcion" class="descripcion">{{ evento.descripcion }}</p>
          </div>
          <div class="acciones">
            <button class="btn-mini" @click="abrirFormEvento(evento)">Editar</button>
            <button class="btn-mini" @click="alternarVisibleEvento(evento)">
              {{ evento.visible ? 'Ocultar' : 'Mostrar' }}
            </button>
            <button class="btn-mini btn-mini--peligro" @click="eliminarEvento(evento)">Eliminar</button>
          </div>
        </div>

        <div class="subeventos">
          <div class="subeventos-cabecera">
            <span>Sub-eventos ({{ evento.subEventos.length }})</span>
            <button class="btn-mini" @click="abrirFormSub(evento)">+ Agregar sub-evento</button>
          </div>

          <form
            v-if="formSub && formSub.eventoId === evento.id"
            class="form-tarjeta form-tarjeta--sub"
            @submit.prevent="guardarSub"
          >
            <h4>{{ formSub.id ? 'Editar sub-evento' : 'Nuevo sub-evento' }}</h4>
            <input
              v-model="formSub.nombre"
              type="text"
              placeholder="Nombre, ej. Charla de animación 3D"
              required
            />
            <textarea v-model="formSub.descripcion" rows="2" placeholder="Descripción corta (opcional)"></textarea>
            <div class="fila-fechas">
              <label>Inicio <input v-model="formSub.inicio" type="datetime-local" required /></label>
              <label>Fin <input v-model="formSub.fin" type="datetime-local" required /></label>
            </div>
            <p class="pista">
              Debe ocurrir dentro de las fechas del evento: la burbuja solo muestra sub-eventos mientras el evento
              esté en curso.
            </p>
            <select v-model="formSub.espacioId" required>
              <option value="" disabled>Espacio donde se realiza…</option>
              <option v-for="espacio in espacios" :key="espacio.id" :value="espacio.id">
                {{ espacio.nombre }} — {{ espacio.bloque?.nombre }} (piso {{ espacio.piso }})
              </option>
            </select>
            <CampoImagen v-model="formSub.imagen" />
            <label class="check"><input v-model="formSub.visible" type="checkbox" /> Visible en la app</label>
            <div class="acciones-form">
              <button type="submit" class="btn-principal" :disabled="guardando">Guardar sub-evento</button>
              <button type="button" class="btn-secundario" @click="formSub = null">Cancelar</button>
            </div>
          </form>

          <ul v-if="evento.subEventos.length" class="lista-sub">
            <li v-for="sub in evento.subEventos" :key="sub.id" class="sub">
              <img v-if="sub.imagen" :src="sub.imagen" alt="" class="miniatura miniatura--sub" />
              <div class="info">
                <div class="titulo-fila">
                  <span class="nombre-sub">{{ sub.nombre }}</span>
                  <span class="estado-chip" :class="`estado-chip--${estadoDe(sub).clave}`">
                    {{ estadoDe(sub).texto }}
                  </span>
                </div>
                <span class="fechas">{{ formatear(sub.inicio) }} → {{ formatear(sub.fin) }}</span>
                <span v-if="sub.espacio" class="lugar">
                  {{ sub.espacio.nombre }} · {{ sub.espacio.bloque?.nombre }} · piso {{ sub.espacio.piso }}
                </span>
                <span v-else class="lugar lugar--falta">Sin lugar: el espacio fue eliminado, elige otro.</span>
              </div>
              <div class="acciones">
                <button class="btn-mini" @click="abrirFormSub(evento, sub)">Editar</button>
                <button class="btn-mini" @click="alternarVisibleSub(sub)">
                  {{ sub.visible ? 'Ocultar' : 'Mostrar' }}
                </button>
                <button class="btn-mini btn-mini--peligro" @click="eliminarSub(sub)">Eliminar</button>
              </div>
            </li>
          </ul>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.eventos-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ayuda {
  font-size: 0.85rem;
  color: var(--ng-ink-soft);
  line-height: 1.45;
}

.error {
  color: var(--ng-danger);
}

.estado {
  color: var(--ng-ink-soft);
}

.btn-principal {
  align-self: flex-start;
  padding: 0.55rem 1rem;
  background: var(--ng-navy);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.88rem;
}

.btn-principal:disabled {
  opacity: 0.6;
}

.btn-secundario {
  padding: 0.55rem 1rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.88rem;
}

.form-tarjeta {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.form-tarjeta--sub {
  background: var(--ng-cream);
}

.form-tarjeta h3,
.form-tarjeta h4 {
  font-family: var(--font-display);
  color: var(--ng-navy);
  font-size: 0.95rem;
}

.form-tarjeta input[type='text'],
.form-tarjeta input[type='datetime-local'],
.form-tarjeta textarea,
.form-tarjeta select {
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.88rem;
  font-family: inherit;
  background: white;
}

.fila-fechas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.fila-fechas label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.78rem;
  color: var(--ng-ink-soft);
}

.pista {
  font-size: 0.75rem;
  color: var(--ng-ink-soft);
}

.check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
}

.acciones-form {
  display: flex;
  gap: 0.5rem;
}

.lista {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tarjeta {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.cabecera,
.sub {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.miniatura {
  width: 96px;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
}

.miniatura--sub {
  width: 72px;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.titulo-fila {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.nombre {
  font-weight: 700;
  color: var(--ng-navy);
}

.nombre-sub {
  font-weight: 600;
  font-size: 0.9rem;
}

.fechas {
  font-size: 0.78rem;
  color: var(--ng-ink-soft);
}

.descripcion {
  font-size: 0.85rem;
}

.lugar {
  font-size: 0.8rem;
  color: var(--ng-navy);
  font-weight: 600;
}

.lugar--falta {
  color: var(--ng-danger);
}

.estado-chip {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
}

.estado-chip--en-curso {
  background: var(--ng-navy);
  color: white;
}

.estado-chip--programado {
  background: var(--ng-accent-light);
  color: var(--ng-navy);
}

.estado-chip--terminado,
.estado-chip--oculto {
  background: var(--ng-cream-mute);
  color: var(--ng-ink-soft);
}

.acciones {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.btn-mini {
  padding: 0.3rem 0.65rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.76rem;
  cursor: pointer;
  white-space: nowrap;
}

.btn-mini--peligro {
  color: var(--ng-danger);
  border-color: var(--ng-danger);
}

.subeventos {
  border-top: 1px dashed var(--color-border);
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.subeventos-cabecera {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ng-ink-soft);
}

.lista-sub {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.sub {
  padding: 0.6rem;
  background: var(--ng-cream);
  border-radius: 8px;
}

@media (max-width: 560px) {
  .cabecera,
  .sub {
    flex-wrap: wrap;
  }

  .acciones {
    flex-direction: row;
  }
}
</style>
