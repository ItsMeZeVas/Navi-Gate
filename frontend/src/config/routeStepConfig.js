// Agrega aquí overrides de pasos cuando ya exista el pin de referencia en
// maps.js. mapId debe coincidir con campusMaps[].id y pinId con pins[].id.
export const routeStepOverrides = [
  // Los pines de entrada, pasillo y escalera pueden usar nodeId:null en maps.js.
  // Un paso admite varios marcadores: el origen de ese tramo y su referencia.
  {
    id: 'pasillo-hacia-bloque-c-piso-1',
    match: /pasillo.*bloque c.*bloque b|pasillo.*bloque b.*bloque c/i,
    locations: [
      { mapId: 'bloques-b-c-d-piso-1', pinId: 'entrada-b', style: 'origen' },
      { mapId: 'bloques-b-c-d-piso-1', pinId: 'pasillo-piso-1-c' },
    ],
  },
  {
    id: 'escalera-hacia-piso-3',
    match: /sube.*escalera.*tercer piso|sube.*escalera.*piso 3/i,
    locations: [{ mapId: 'bloques-b-c-d-piso-3', pinId: 'escaleras-piso-3-c' }],
  },
  {
    id: 'pasillo-bloque-c-piso-3',
    match: /pasillo.*bloque c.*piso 3|pasillo.*bloque c.*tercer piso/i,
    locations: [{ mapId: 'bloques-b-c-d-piso-3', pinId: 'pasillo-piso-3-c' }],
  },
]

// Ejemplo de texto de ruta; las instrucciones reales provienen de la API.
export const sampleRoute = {
  name: 'Ejemplo de ruta por los bloques B, C y D',
  steps: [
    'Camina hacia pasillo bloque C a bloque B.',
    'Sube por la escalera hasta el tercer piso.',
    'Camina hacia el pasillo bloque C piso 3.',
    'Llega al salón C302.',
  ],
}
