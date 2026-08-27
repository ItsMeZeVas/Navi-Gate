// Lógica del grafo de mapeo: sincronización de la base (Qr/Bloque/Espacio
// y sus relaciones existentes) con el grafo persistido, búsqueda del
// camino más corto (BFS) y generación de instrucciones en texto natural.
//
// Nada de esto se ejecuta a menos que el admin abra la vista de grafo o
// pida generar una ruta: el flujo manual de siempre no pasa por aquí.
const prisma = require('../prismaClient');

// ---------------------------------------------------------------------
// Sincronización: crea (si faltan) los nodos ligados a Qr/Bloque/Espacio
// y los edges implícitos por relaciones ya existentes en la base de
// datos (Espacio -> su Bloque, Qr -> Bloque por cada Ruta manual).
// Es acumulativo: solo agrega lo que falta, nunca borra ni reposiciona
// lo que el admin ya movió a mano.
// ---------------------------------------------------------------------
async function sincronizarGrafoBase() {
  const [qrs, bloques, espacios] = await Promise.all([
    prisma.qr.findMany(),
    prisma.bloque.findMany(),
    prisma.espacio.findMany(),
  ]);

  // Nodos ligados que ya existen, para no duplicar.
  const nodosExistentes = await prisma.nodoGrafo.findMany();
  const tieneNodoQr = new Set(nodosExistentes.filter((n) => n.qrId).map((n) => n.qrId));
  const tieneNodoBloque = new Set(nodosExistentes.filter((n) => n.bloqueId).map((n) => n.bloqueId));
  const tieneNodoEspacio = new Set(nodosExistentes.filter((n) => n.espacioId).map((n) => n.espacioId));

  // Posición por defecto en cuadrícula simple, solo para que el nodo
  // aparezca en algún lado visible la primera vez; el admin lo mueve.
  let contador = nodosExistentes.length;
  const siguientePosicion = () => {
    const col = contador % 6;
    const fila = Math.floor(contador / 6);
    contador += 1;
    return { posX: 120 + col * 220, posY: 120 + fila * 160 };
  };

  const creaciones = [];

  for (const qr of qrs) {
    if (!tieneNodoQr.has(qr.id)) {
      creaciones.push(
        prisma.nodoGrafo.create({ data: { tipo: 'QR', qrId: qr.id, ...siguientePosicion() } }),
      );
    }
  }
  for (const bloque of bloques) {
    if (!tieneNodoBloque.has(bloque.id)) {
      creaciones.push(
        prisma.nodoGrafo.create({ data: { tipo: 'BLOQUE', bloqueId: bloque.id, ...siguientePosicion() } }),
      );
    }
  }
  for (const espacio of espacios) {
    if (!tieneNodoEspacio.has(espacio.id)) {
      creaciones.push(
        prisma.nodoGrafo.create({
          data: { tipo: 'ESPACIO', espacioId: espacio.id, piso: espacio.piso, ...siguientePosicion() },
        }),
      );
    }
  }

  if (creaciones.length > 0) {
    await Promise.all(creaciones);
  }

  // Volvemos a leer para tener los ids de los nodos recién creados.
  const nodosActualizados = await prisma.nodoGrafo.findMany();
  const nodoPorQr = new Map(nodosActualizados.filter((n) => n.qrId).map((n) => [n.qrId, n]));
  const nodoPorBloque = new Map(nodosActualizados.filter((n) => n.bloqueId).map((n) => [n.bloqueId, n]));
  const nodoPorEspacio = new Map(nodosActualizados.filter((n) => n.espacioId).map((n) => [n.espacioId, n]));

  // Edges implícitos: SOLO se ofrecen una vez por relación (marcada con
  // "edgeGrafoSincronizado"), nunca en base a si el edge sigue existiendo
  // ahora mismo. Así, si el admin borra una conexión del grafo, se queda
  // borrada aunque la relación original (Ruta, Espacio-Bloque) siga viva.
  const espaciosPendientes = espacios.filter((e) => !e.edgeGrafoSincronizado);
  const rutasPendientes = await prisma.ruta.findMany({
    where: { bloqueId: { not: null }, edgeGrafoSincronizado: false },
  });

  const nuevosEdges = [];
  const idsEspaciosSincronizados = [];
  const idsRutasSincronizadas = [];

  for (const espacio of espaciosPendientes) {
    const nodoEspacio = nodoPorEspacio.get(espacio.id);
    const nodoBloque = nodoPorBloque.get(espacio.bloqueId);
    if (nodoEspacio && nodoBloque) {
      nuevosEdges.push({ origenId: nodoBloque.id, destinoId: nodoEspacio.id });
    }
    idsEspaciosSincronizados.push(espacio.id);
  }

  for (const ruta of rutasPendientes) {
    const nodoQr = nodoPorQr.get(ruta.qrId);
    const nodoBloque = nodoPorBloque.get(ruta.bloqueId);
    if (nodoQr && nodoBloque) {
      nuevosEdges.push({ origenId: nodoQr.id, destinoId: nodoBloque.id });
    }
    idsRutasSincronizadas.push(ruta.id);
  }

  if (nuevosEdges.length > 0) {
    await prisma.edgeGrafo.createMany({ data: nuevosEdges, skipDuplicates: true });
  }
  if (idsEspaciosSincronizados.length > 0) {
    await prisma.espacio.updateMany({
      where: { id: { in: idsEspaciosSincronizados } },
      data: { edgeGrafoSincronizado: true },
    });
  }
  if (idsRutasSincronizadas.length > 0) {
    await prisma.ruta.updateMany({
      where: { id: { in: idsRutasSincronizadas } },
      data: { edgeGrafoSincronizado: true },
    });
  }
}

// ---------------------------------------------------------------------
// Devuelve el grafo completo (ya sincronizado) con etiquetas resueltas
// en vivo para los nodos ligados a una entidad.
// ---------------------------------------------------------------------
async function obtenerGrafoCompleto() {
  await sincronizarGrafoBase();

  const [nodos, edges] = await Promise.all([
    prisma.nodoGrafo.findMany({
      include: { qr: true, bloque: true, espacio: true },
      orderBy: { id: 'asc' },
    }),
    prisma.edgeGrafo.findMany({ orderBy: { id: 'asc' } }),
  ]);

  const nodosConEtiqueta = nodos.map((nodo) => ({
    ...nodo,
    etiqueta: nodo.qr?.nombre ?? nodo.bloque?.nombre ?? nodo.espacio?.nombre ?? nodo.etiqueta ?? 'Sin nombre',
  }));

  return { nodos: nodosConEtiqueta, edges };
}

// ---------------------------------------------------------------------
// BFS: camino con menos saltos entre dos nodos, tratando los edges
// como bidireccionales (un tramo caminable se recorre en ambos sentidos).
// ---------------------------------------------------------------------
function buscarCaminoMasCorto(nodos, edges, origenId, destinoId) {
  const adyacencia = new Map();
  for (const nodo of nodos) adyacencia.set(nodo.id, []);
  for (const edge of edges) {
    adyacencia.get(edge.origenId)?.push({ nodoId: edge.destinoId, edgeId: edge.id });
    adyacencia.get(edge.destinoId)?.push({ nodoId: edge.origenId, edgeId: edge.id });
  }

  const visitados = new Set([origenId]);
  const cola = [{ nodoId: origenId, caminoNodos: [origenId], caminoEdges: [] }];

  while (cola.length > 0) {
    const actual = cola.shift();
    if (actual.nodoId === destinoId) {
      return { nodosUsados: actual.caminoNodos, edgesUsados: actual.caminoEdges };
    }
    for (const vecino of adyacencia.get(actual.nodoId) ?? []) {
      if (!visitados.has(vecino.nodoId)) {
        visitados.add(vecino.nodoId);
        cola.push({
          nodoId: vecino.nodoId,
          caminoNodos: [...actual.caminoNodos, vecino.nodoId],
          caminoEdges: [...actual.caminoEdges, vecino.edgeId],
        });
      }
    }
  }

  return null; // no hay camino conectado
}

// ---------------------------------------------------------------------
// Convierte una secuencia de nodos en pasos de texto natural, según el
// tipo de cada nodo. El primer nodo (origen/QR) nunca genera un paso;
// se narra desde el segundo nodo en adelante.
// ---------------------------------------------------------------------
function generarInstrucciones(secuenciaNodos) {
  const pasos = [];
  let pisoActual = secuenciaNodos[0]?.piso ?? null;

  for (let i = 1; i < secuenciaNodos.length; i += 1) {
    const nodo = secuenciaNodos[i];
    const nombre = nodo.etiqueta;

    switch (nodo.tipo) {
      case 'ESCALERA':
      case 'ASCENSOR': {
        const medio = nodo.tipo === 'ESCALERA' ? 'la escalera' : 'el ascensor';
        const destinoPiso = nodo.pisoHasta ?? null;
        if (destinoPiso != null && pisoActual != null && destinoPiso !== pisoActual) {
          const verbo = destinoPiso > pisoActual ? 'Sube' : 'Baja';
          pasos.push(`${verbo} por ${medio} hasta el piso ${destinoPiso}.`);
          pisoActual = destinoPiso;
        } else {
          pasos.push(`Usa ${medio} en ${nombre}.`);
          if (destinoPiso != null) pisoActual = destinoPiso;
        }
        break;
      }
      case 'PUERTA':
        pasos.push(`Pasa por ${nombre}.`);
        break;
      case 'ESPACIO':
        pasos.push(`Llega a ${nombre}.`);
        break;
      case 'BLOQUE':
        pasos.push(`Dirígete hacia ${nombre}.`);
        break;
      case 'QR':
        // Un QR intermedio en el camino (poco común) se trata como punto de paso.
        pasos.push(`Dirígete hacia ${nombre}.`);
        break;
      case 'PASILLO':
        pasos.push(`Camina hacia ${nombre}.`);
        break;
      case 'PUNTO_REFERENCIA':
      default:
        pasos.push(`Dirígete hacia ${nombre}.`);
        break;
    }

    if (nodo.piso != null && nodo.tipo !== 'ESCALERA' && nodo.tipo !== 'ASCENSOR') {
      pisoActual = nodo.piso;
    }
  }

  return pasos;
}

// ---------------------------------------------------------------------
// Genera (sin guardar) los pasos para ir de un Qr a un Bloque o Espacio.
// Lanza un error con .noHayCamino = true si el grafo no los conecta.
// ---------------------------------------------------------------------
async function generarRutaDesdeGrafo({ qrId, bloqueId, espacioId }) {
  const { nodos, edges } = await obtenerGrafoCompleto();

  const nodoOrigen = nodos.find((n) => n.qrId === qrId);
  const nodoDestino = bloqueId
    ? nodos.find((n) => n.bloqueId === bloqueId)
    : nodos.find((n) => n.espacioId === espacioId);

  if (!nodoOrigen || !nodoDestino) {
    const error = new Error('El origen o el destino todavía no existen en el grafo.');
    error.noHayCamino = true;
    throw error;
  }

  const camino = buscarCaminoMasCorto(nodos, edges, nodoOrigen.id, nodoDestino.id);
  if (!camino) {
    const error = new Error('No hay un camino conectado entre estos dos puntos en el grafo.');
    error.noHayCamino = true;
    throw error;
  }

  const nodosPorId = new Map(nodos.map((n) => [n.id, n]));
  const secuenciaNodos = camino.nodosUsados.map((id) => nodosPorId.get(id));
  const instrucciones = generarInstrucciones(secuenciaNodos);

  return {
    instrucciones,
    nodosUsados: camino.nodosUsados,
    edgesUsados: camino.edgesUsados,
  };
}

// ---------------------------------------------------------------------
// Marca como desactualizadas las rutas que usaron un nodo o edge que
// está por eliminarse. Se llama antes de borrar en las rutas del grafo.
// ---------------------------------------------------------------------
async function marcarRutasDesactualizadasPorNodo(nodoId) {
  await prisma.$executeRaw`
    UPDATE rutas SET "desactualizada" = true
    WHERE ${nodoId} = ANY("nodosGrafoUsados")
  `;
}

async function marcarRutasDesactualizadasPorEdge(edgeId) {
  await prisma.$executeRaw`
    UPDATE rutas SET "desactualizada" = true
    WHERE ${edgeId} = ANY("edgesGrafoUsados")
  `;
}

module.exports = {
  obtenerGrafoCompleto,
  generarRutaDesdeGrafo,
  marcarRutasDesactualizadasPorNodo,
  marcarRutasDesactualizadasPorEdge,
};
