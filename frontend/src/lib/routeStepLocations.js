import { campusMaps } from '../config/maps'
import { routeStepOverrides } from '../config/routeStepConfig'
import { getMapLocationsByNodeId } from './mapLocations'

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function normalizarId(texto) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, ' ').trim()
}

export function inferirBloque(texto) {
  const normalizado = normalizar(texto)
  if (/aula maxima|aula max/.test(normalizado)) return 'AM'
  const explicito = normalizado.match(/(?:bloque|entrada|block)\s*([a-f])\b/)
  if (explicito) return explicito[1].toUpperCase()
  const codigoSalon = normalizado.match(/\b([a-f])\s*\d{3,4}\b/)
  return codigoSalon?.[1]?.toUpperCase() || null
}

function tipoPinApoyo(pin) {
  if (pin?.nodeId != null) return null
  const id = normalizar(pin?.id)
  if (id.includes('escalera') || id.includes('ascensor')) return 'escalera'
  if (id.includes('pasillo') || id.includes('conexion')) return 'pasillo'
  if (id.includes('entrada') || id.includes('salida')) return 'entrada'
  return null
}

function bloqueEnMapa(map, codigo) {
  if (!codigo) return false
  const id = normalizarId(map?.id)
  if (codigo === 'AM') return id.includes('aula maxima')
  if (['B', 'C', 'D'].includes(codigo)) return id.includes('bloques b c d')
  return id.includes(`bloque ${String(codigo || '').toLowerCase()}`)
}

function pisoEnMapa(map, piso) {
  const id = normalizarId(map?.id)
  if (piso === 'sotano') return id.includes('sotano')
  if (piso == null) return false
  return id.includes(`piso ${piso}`) || (piso === 5 && id.includes('pisos 4 y 5'))
}

function pisoDelMapa(map, fallback = null) {
  const id = normalizarId(map?.id)
  if (id.includes('sotano')) return 'sotano'
  const match = id.match(/piso\s+(\d+)/)
  return match ? Number(match[1]) : fallback
}

function pisoDelPaso(texto, pisoFallback) {
  const t = normalizar(texto)
  if (/\bsotano\b/.test(t)) return 'sotano'
  const numerico = t.match(/piso\s+(\d+)/)
  if (numerico) return Number(numerico[1])
  const ordinales = [
    [/primer(?:o)? piso/, 1],
    [/segundo piso/, 2],
    [/tercer(?:o)? piso/, 3],
    [/cuarto piso/, 4],
    [/quinto piso/, 5],
  ]
  return ordinales.find(([regex]) => regex.test(t))?.[1] ?? pisoFallback ?? null
}

function elegirPinesApoyo(map, tipo, bloqueDestino, bloqueOrigen) {
  const candidatos = (map?.pins || []).filter((pin) => tipoPinApoyo(pin) === tipo)
  if (candidatos.length <= 1) return candidatos

  // En los planos del bloque E las escaleras están diferenciadas por el
  // bloque desde el que se accede; en B/C/D se diferencian por el bloque.
  if (tipo === 'escalera' && bloqueOrigen) {
    const desdeOrigen = candidatos.filter((pin) =>
      normalizarId(pin.id).includes(`desde bloque ${bloqueOrigen.toLowerCase()}`),
    )
    if (desdeOrigen.length) return desdeOrigen
  }
  if (bloqueDestino) {
    const porDestino = candidatos.filter((pin) => {
      const id = normalizarId(pin.id)
      return new RegExp(`(?:^|\\s)${bloqueDestino.toLowerCase()}(?:$|\\s)`).test(id)
    })
    if (porDestino.length) return porDestino
  }
  // Si el bloque no permite elegir una sola, se muestran las referencias del
  // mismo tipo del mapa actual; así no se inventa una ubicación puntual.
  return candidatos
}

function resolverPasoPorPinesApoyo(stepText, maps, context) {
  const t = normalizar(stepText)
  const esEscalera = /escalera|ascensor|sube|baja/.test(t)
  const esPasillo = /pasillo|corredor|conexion/.test(t)
  if (!esEscalera && !esPasillo) return []

  const tipo = esEscalera ? 'escalera' : 'pasillo'
  const codigoDestino = context.destinationBlockCode || inferirBloque(context.destinationName || context.destinationBlockName)
  const codigoOrigen = context.previousBlockCode
    || context.originBlockCode
    || inferirBloque(context.originName)
  const codigoPaso = inferirBloque(stepText)
  const codigoActual = context.currentBlockCode || codigoPaso || codigoDestino || codigoOrigen
  let map = null

  if (esEscalera) {
    const piso = pisoDelPaso(stepText, context.destinationFloor)
    map = maps.find((candidate) => bloqueEnMapa(candidate, codigoActual) && pisoEnMapa(candidate, piso))
      || maps.find((candidate) => bloqueEnMapa(candidate, codigoDestino) && pisoEnMapa(candidate, piso))
      || maps.find((candidate) => (context.destinationMapIds || []).includes(candidate.id) && pisoEnMapa(candidate, piso))
      || null
  } else {
    const currentMap = maps.find((candidate) => candidate.id === context.currentMapId)
    const pasoBlock = codigoPaso || context.currentBlockCode || codigoDestino
    const floor = pisoDelPaso(stepText, pisoDelMapa(currentMap, context.destinationFloor))
    map = pasoBlock && currentMap && !bloqueEnMapa(currentMap, pasoBlock)
      ? maps.find((candidate) => bloqueEnMapa(candidate, pasoBlock) && pisoEnMapa(candidate, floor))
      : currentMap
    map ||= maps.find((candidate) => bloqueEnMapa(candidate, pasoBlock) && pisoEnMapa(candidate, floor))
      || maps.find((candidate) => (context.destinationMapIds || []).includes(candidate.id))
      || null
  }

  if (!map) return []
  const bloquePin = codigoPaso || codigoActual || codigoDestino
  const pines = elegirPinesApoyo(map, tipo, bloquePin, codigoOrigen)
  if (pines.length) return pines.map((pin) => ({ map, pin, source: 'support-pin' }))
  // Aunque falte el marcador, la imagen correcta del tramo puede mostrarse.
  return [{ map, pin: null, source: 'support-map' }]
}

export function resolverEntradaOrigen(nombreOrigen, maps, preferredMapId = null) {
  const codigo = inferirBloque(nombreOrigen)
  if (!codigo) return null
  const entradas = maps.flatMap((map) => (map.pins || [])
    .filter((pin) => {
      const id = normalizarId(pin.id)
      return tipoPinApoyo(pin) === 'entrada'
        && new RegExp(`(?:^|\\s)${codigo.toLowerCase()}(?:$|\\s)`).test(id)
    })
    .map((pin) => ({ map, pin: { ...pin, style: 'origen' }, source: 'origin-entry' })))
  return entradas.find((item) => item.map.id === preferredMapId) || entradas[0] || null
}

function resolverOverride(stepText, nodeId, maps) {
  const override = routeStepOverrides.find((item) => {
    if (item.nodeId != null && String(item.nodeId) === String(nodeId)) return true
    if (!item.match) return false
    item.match.lastIndex = 0
    return item.match.test(stepText)
  })
  if (!override) return []

  return override.locations.flatMap((reference) => {
    const map = maps.find((item) => item.id === reference.mapId)
    const pin = map?.pins?.find((item) => String(item.id) === String(reference.pinId))
    // Un override puede seleccionar primero el mapa aunque el pin todavía
    // no exista; así se puede añadir/calibrar luego sin depender del grafo.
    const pinConEstilo = pin
      ? { ...pin, ...(reference.style ? { style: reference.style } : {}) }
      : null
    return map ? [{ map, pin: pinConEstilo, source: `override:${override.id}` }] : []
  })
}

// Acepta texto plano (formato actual de la API) y objetos { text, nodeId }
// para que una futura API pueda asociar los pasos directamente a nodos.
export function resolveRouteStepLocations(step, maps = campusMaps, context = {}) {
  const stepText = typeof step === 'string' ? step : step?.text || step?.instruccion || ''
  const nodeId = typeof step === 'object' ? step?.nodeId : null
  const overridden = resolverOverride(stepText, nodeId, maps)
  if (overridden.length) return overridden

  if (nodeId != null) {
    const directLocations = getMapLocationsByNodeId(nodeId, maps)
      .map((item) => ({ ...item, source: 'node' }))
      .sort((a, b) => (b.map.priority || 0) - (a.map.priority || 0))
    if (directLocations.length) return directLocations
  }

  const supportLocations = resolverPasoPorPinesApoyo(stepText, maps, context)
  if (supportLocations.length) return supportLocations

  const textoNormalizado = normalizar(stepText)
  const porNombre = maps.flatMap((map) =>
    (map.pins || [])
      .filter((pin) => {
        if (pin.nodeId == null) return false
        const etiqueta = normalizar(pin.label)
        return etiqueta.length >= 3 && textoNormalizado.includes(etiqueta)
      })
      .map((pin) => ({ map, pin, source: 'label' })),
  )
  return porNombre.sort((a, b) => (b.map.priority || 0) - (a.map.priority || 0))
}
