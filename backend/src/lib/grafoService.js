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
    // Una ruta generada desde el grafo (guarda el camino que usó) ya está
    // reflejada en él: crear además una conexión directa Qr→Bloque metería
    // un atajo falso que acortaría los caminos calculados después. Solo las
    // rutas manuales (sin camino guardado) representan una conexión nueva.
    const esManual = !ruta.nodosGrafoUsados || ruta.nodosGrafoUsados.length === 0;
    const nodoQr = nodoPorQr.get(ruta.qrId);
    const nodoBloque = nodoPorBloque.get(ruta.bloqueId);
    if (esManual && nodoQr && nodoBloque) {
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
function construirAdyacencia(nodos, edges) {
  const adyacencia = new Map();
  for (const nodo of nodos) adyacencia.set(nodo.id, []);
  for (const edge of edges) {
    adyacencia.get(edge.origenId)?.push({ nodoId: edge.destinoId, edgeId: edge.id });
    adyacencia.get(edge.destinoId)?.push({ nodoId: edge.origenId, edgeId: edge.id });
  }
  return adyacencia;
}

// Un solo recorrido BFS desde el origen que deja, para cada nodo alcanzable,
// de dónde se llegó a él (así se obtienen los caminos a TODOS los destinos
// sin repetir la búsqueda por cada uno).
function arbolDeCaminos(adyacencia, origenId) {
  const previo = new Map([[origenId, null]]);
  const cola = [origenId];
  for (let i = 0; i < cola.length; i += 1) {
    const actual = cola[i];
    for (const vecino of adyacencia.get(actual) ?? []) {
      if (!previo.has(vecino.nodoId)) {
        previo.set(vecino.nodoId, { nodoId: actual, edgeId: vecino.edgeId });
        cola.push(vecino.nodoId);
      }
    }
  }
  return previo;
}

function reconstruirCamino(previo, origenId, destinoId) {
  if (!previo.has(destinoId)) return null; // no hay camino conectado
  const nodosUsados = [destinoId];
  const edgesUsados = [];
  let actual = destinoId;
  while (actual !== origenId) {
    const anterior = previo.get(actual);
    edgesUsados.unshift(anterior.edgeId);
    nodosUsados.unshift(anterior.nodoId);
    actual = anterior.nodoId;
  }
  return { nodosUsados, edgesUsados };
}

function buscarCaminoMasCorto(nodos, edges, origenId, destinoId) {
  const previo = arbolDeCaminos(construirAdyacencia(nodos, edges), origenId);
  return reconstruirCamino(previo, origenId, destinoId);
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
    const esDestino = i === secuenciaNodos.length - 1;

    // Si el destino ES una escalera, un ascensor o un punto de referencia,
    // la persona va a llegar hasta él (no a subir/bajar por él).
    if (esDestino && ['ESCALERA', 'ASCENSOR', 'PUNTO_REFERENCIA'].includes(nodo.tipo)) {
      pasos.push(`Llega a ${nombre}.`);
      break;
    }

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
// Generación MASIVA de rutas: de uno o todos los QR hacia todos los
// destinos (bloques, espacios y puntos del grafo marcados como visibles).
// Se hace en dos pasos para que el admin decida antes de tocar nada:
//   1) previsualizarRutasMasivas: calcula y reporta, sin escribir.
//   2) aplicarRutasMasivas: escribe, respetando lo que el admin eligió.
// ---------------------------------------------------------------------
const ETIQUETA_TIPO_NODO = {
  PUNTO_REFERENCIA: 'Punto de referencia',
  ESCALERA: 'Escalera',
  ASCENSOR: 'Ascensor',
  PASILLO: 'Pasillo',
  PUERTA: 'Puerta',
};

const claveRuta = (qrId, tipo, id) => `${qrId}:${tipo}:${id}`;

function tipoYIdDeRuta(ruta) {
  if (ruta.bloqueId) return { tipo: 'bloque', id: ruta.bloqueId };
  if (ruta.espacioId) return { tipo: 'espacio', id: ruta.espacioId };
  return { tipo: 'nodo', id: ruta.nodoGrafoId };
}

function listarDestinos(nodos) {
  const nodoDeBloque = new Map(nodos.filter((n) => n.bloqueId).map((n) => [n.bloqueId, n]));
  const destinos = [];
  for (const nodo of nodos) {
    if (nodo.bloqueId) {
      destinos.push({ tipo: 'bloque', id: nodo.bloqueId, nodoId: nodo.id, nombre: nodo.etiqueta, detalle: 'Bloque' });
    } else if (nodo.espacioId) {
      const bloque = nodoDeBloque.get(nodo.espacio?.bloqueId);
      destinos.push({
        tipo: 'espacio',
        id: nodo.espacioId,
        nodoId: nodo.id,
        nombre: nodo.etiqueta,
        detalle: bloque ? bloque.etiqueta : 'Espacio',
      });
    } else if (!nodo.qrId && nodo.visibleEnApp) {
      destinos.push({
        tipo: 'nodo',
        id: nodo.id,
        nodoId: nodo.id,
        nombre: nodo.etiqueta,
        detalle: ETIQUETA_TIPO_NODO[nodo.tipo] ?? 'Punto',
      });
    }
  }
  return destinos;
}

const mismasInstrucciones = (a, b) =>
  a.length === b.length && a.every((paso, i) => paso.trim() === (b[i] ?? '').trim());

async function calcularPlanRutasMasivas({ qrIds }) {
  const { nodos, edges } = await obtenerGrafoCompleto();
  const adyacencia = construirAdyacencia(nodos, edges);
  const nodosPorId = new Map(nodos.map((n) => [n.id, n]));
  const destinos = listarDestinos(nodos);
  const nodosQr = nodos.filter((n) => n.qrId && (!qrIds || qrIds.includes(n.qrId)));

  const existentes = await prisma.ruta.findMany({
    where: qrIds ? { qrId: { in: qrIds } } : {},
    select: { id: true, qrId: true, bloqueId: true, espacioId: true, nodoGrafoId: true, instrucciones: true },
  });
  const existentePorClave = new Map(
    existentes.map((r) => {
      const { tipo, id } = tipoYIdDeRuta(r);
      return [claveRuta(r.qrId, tipo, id), r];
    }),
  );

  const items = [];
  const sinCamino = [];

  for (const nodoQr of nodosQr) {
    const previo = arbolDeCaminos(adyacencia, nodoQr.id);
    const inalcanzables = [];

    for (const destino of destinos) {
      const camino = reconstruirCamino(previo, nodoQr.id, destino.nodoId);
      if (!camino) {
        inalcanzables.push({ tipo: destino.tipo, nombre: destino.nombre, detalle: destino.detalle });
        continue;
      }

      const instrucciones = generarInstrucciones(camino.nodosUsados.map((id) => nodosPorId.get(id)));
      const clave = claveRuta(nodoQr.qrId, destino.tipo, destino.id);
      const existente = existentePorClave.get(clave) ?? null;

      let estado = 'nueva';
      if (existente) estado = mismasInstrucciones(existente.instrucciones, instrucciones) ? 'igual' : 'conflicto';

      items.push({
        clave,
        estado,
        qrId: nodoQr.qrId,
        qrNombre: nodoQr.etiqueta,
        destino,
        instrucciones,
        nodosUsados: camino.nodosUsados,
        edgesUsados: camino.edgesUsados,
        existente,
      });
    }

    if (inalcanzables.length > 0) {
      sinCamino.push({ qrId: nodoQr.qrId, qrNombre: nodoQr.etiqueta, destinos: inalcanzables });
    }
  }

  return { items, sinCamino, totalQrs: nodosQr.length, totalDestinos: destinos.length };
}

async function previsualizarRutasMasivas({ qrIds }) {
  const plan = await calcularPlanRutasMasivas({ qrIds });
  const cuenta = (estado) => plan.items.filter((i) => i.estado === estado).length;

  return {
    resumen: {
      qrs: plan.totalQrs,
      destinos: plan.totalDestinos,
      nuevas: cuenta('nueva'),
      iguales: cuenta('igual'),
      conflictos: cuenta('conflicto'),
      sinCamino: plan.sinCamino.reduce((total, q) => total + q.destinos.length, 0),
    },
    conflictos: plan.items
      .filter((i) => i.estado === 'conflicto')
      .map((i) => ({
        clave: i.clave,
        qrNombre: i.qrNombre,
        destino: { tipo: i.destino.tipo, nombre: i.destino.nombre, detalle: i.destino.detalle },
        existente: i.existente.instrucciones,
        nueva: i.instrucciones,
      })),
    sinCamino: plan.sinCamino,
  };
}

function datosDeRutaNueva(item) {
  return {
    qrId: item.qrId,
    bloqueId: item.destino.tipo === 'bloque' ? item.destino.id : null,
    espacioId: item.destino.tipo === 'espacio' ? item.destino.id : null,
    nodoGrafoId: item.destino.tipo === 'nodo' ? item.destino.id : null,
    instrucciones: item.instrucciones,
    fotos: [],
    nodosGrafoUsados: item.nodosUsados,
    edgesGrafoUsados: item.edgesUsados,
    desactualizada: false,
    edgeGrafoSincronizado: true,
  };
}

function enLotes(lista, tamano) {
  const lotes = [];
  for (let i = 0; i < lista.length; i += tamano) lotes.push(lista.slice(i, i + tamano));
  return lotes;
}

// "reemplazar": claves (qrId:tipo:id) de las rutas existentes que el admin
// eligió reemplazar. Se crean todas las rutas nuevas; una ruta que ya existía
// y es distinta SOLO se toca si su clave viene en "reemplazar" (así, nada que
// el admin no haya visto en la vista previa se sobrescribe). Las idénticas
// no se tocan.
async function aplicarRutasMasivas({ qrIds, reemplazar = [] }) {
  const plan = await calcularPlanRutasMasivas({ qrIds });
  const aReemplazar = new Set(reemplazar);

  const nuevas = [];
  const reemplazos = [];
  let conservadas = 0;
  for (const item of plan.items) {
    if (item.estado === 'nueva') nuevas.push(item);
    else if (item.estado === 'conflicto') {
      if (aReemplazar.has(item.clave)) reemplazos.push(item);
      else conservadas += 1;
    }
  }

  for (const lote of enLotes(nuevas, 500)) {
    await prisma.ruta.createMany({ data: lote.map(datosDeRutaNueva), skipDuplicates: true });
  }

  // Al reemplazar se actualiza solo el recorrido: las fotos que la ruta
  // existente ya tuviera se conservan.
  for (const lote of enLotes(reemplazos, 100)) {
    await prisma.$transaction(
      lote.map((item) =>
        prisma.ruta.update({
          where: { id: item.existente.id },
          data: {
            instrucciones: item.instrucciones,
            nodosGrafoUsados: item.nodosUsados,
            edgesGrafoUsados: item.edgesUsados,
            desactualizada: false,
            edgeGrafoSincronizado: true,
          },
        }),
      ),
    );
  }

  return {
    creadas: nuevas.length,
    reemplazadas: reemplazos.length,
    conservadas,
    iguales: plan.items.filter((i) => i.estado === 'igual').length,
    sinCamino: plan.sinCamino,
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
  previsualizarRutasMasivas,
  aplicarRutasMasivas,
  // Internos, expuestos para pruebas:
  arbolDeCaminos,
  reconstruirCamino,
  construirAdyacencia,
  generarInstrucciones,
  sincronizarGrafoBase,
  marcarRutasDesactualizadasPorNodo,
  marcarRutasDesactualizadasPorEdge,
};
