import { campusMaps } from '../config/maps'

// Un destino puede tener puntos distintos en varios mapas (p. ej. campus y piso).
export function getMapLocationsByNodeId(nodeId, maps = campusMaps) {
  if (nodeId === null || nodeId === undefined) return []
  return maps.flatMap((map) =>
    (map.pins || [])
      .filter((pin) => String(pin.nodeId) === String(nodeId))
      .map((pin) => ({ map, pin })),
  )
}

export function getPinsForMap(mapId, maps = campusMaps) {
  return maps.find((map) => map.id === mapId)?.pins || []
}
