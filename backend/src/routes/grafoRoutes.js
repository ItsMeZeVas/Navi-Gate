const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');
const {
  obtenerGrafoCompleto,
  generarRutaDesdeGrafo,
  marcarRutasDesactualizadasPorNodo,
  marcarRutasDesactualizadasPorEdge,
} = require('../lib/grafoService');

const router = express.Router();

const TIPOS_NODO_INTERMEDIO = ['PASILLO', 'ESCALERA', 'ASCENSOR', 'PUERTA', 'PUNTO_REFERENCIA'];

// Todo lo del grafo es exclusivo del panel admin.
router.use(requireAuth);

// GET /api/grafo
// Devuelve nodos + edges, sincronizando primero con Qr/Bloque/Espacio y
// las relaciones (Rutas) que ya existan pero no estén reflejadas aún.
router.get('/', async (req, res) => {
  try {
    const grafo = await obtenerGrafoCompleto();
    res.json(grafo);
  } catch (error) {
    console.error('Error en GET /grafo:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/grafo/nodos
// Crea un nodo intermedio (pasillo, escalera, ascensor, puerta o punto
// de referencia). Los nodos ligados a Qr/Bloque/Espacio se crean solos
// al sincronizar, no se crean desde aquí.
router.post('/nodos', async (req, res) => {
  const { tipo, etiqueta, posX, posY, piso, pisoHasta } = req.body;

  if (!TIPOS_NODO_INTERMEDIO.includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de nodo inválido para un nodo intermedio.' });
  }
  if (!etiqueta || !etiqueta.trim()) {
    return res.status(400).json({ error: 'El nombre del nodo es obligatorio.' });
  }

  try {
    const nodo = await prisma.nodoGrafo.create({
      data: {
        tipo,
        etiqueta: etiqueta.trim(),
        posX: posX ?? 0,
        posY: posY ?? 0,
        piso: piso !== undefined && piso !== null && piso !== '' ? Number(piso) : null,
        pisoHasta: pisoHasta !== undefined && pisoHasta !== null && pisoHasta !== '' ? Number(pisoHasta) : null,
      },
    });
    res.status(201).json(nodo);
  } catch (error) {
    console.error('Error en POST /grafo/nodos:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PATCH /api/grafo/nodos/:id
// Actualiza posición (al arrastrar en el lienzo) y, para nodos
// intermedios, también nombre/piso/pisoHasta.
router.patch('/nodos/:id', async (req, res) => {
  const { posX, posY, etiqueta, piso, pisoHasta } = req.body;
  const data = {};

  if (posX !== undefined) data.posX = Number(posX);
  if (posY !== undefined) data.posY = Number(posY);
  if (etiqueta !== undefined && etiqueta.trim()) data.etiqueta = etiqueta.trim();
  if (piso !== undefined) data.piso = piso === null || piso === '' ? null : Number(piso);
  if (pisoHasta !== undefined) data.pisoHasta = pisoHasta === null || pisoHasta === '' ? null : Number(pisoHasta);

  try {
    const nodo = await prisma.nodoGrafo.update({ where: { id: Number(req.params.id) }, data });
    res.json(nodo);
  } catch (error) {
    res.status(404).json({ error: 'Nodo no encontrado.' });
  }
});

// DELETE /api/grafo/nodos/:id
// Borra un nodo del grafo (y sus edges, en cascada). Si el nodo estaba
// ligado a un Qr/Bloque/Espacio, SOLO se borra su posición dentro del
// grafo: la entidad real (Qr/Bloque/Espacio) no se toca para nada.
// Cualquier ruta que haya usado este nodo (o sus edges) para generarse
// queda marcada como desactualizada.
router.delete('/nodos/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const edgesRelacionados = await prisma.edgeGrafo.findMany({
      where: { OR: [{ origenId: id }, { destinoId: id }] },
    });

    await marcarRutasDesactualizadasPorNodo(id);
    for (const edge of edgesRelacionados) {
      await marcarRutasDesactualizadasPorEdge(edge.id);
    }

    await prisma.nodoGrafo.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error en DELETE /grafo/nodos/:id:', error);
    res.status(404).json({ error: 'Nodo no encontrado.' });
  }
});

// POST /api/grafo/edges
// Conecta dos nodos existentes (tramo caminable entre ambos).
router.post('/edges', async (req, res) => {
  const { origenId, destinoId } = req.body;

  if (!origenId || !destinoId || origenId === destinoId) {
    return res.status(400).json({ error: 'Se necesitan dos nodos distintos para conectar.' });
  }

  try {
    const edge = await prisma.edgeGrafo.create({
      data: { origenId: Number(origenId), destinoId: Number(destinoId) },
    });
    res.status(201).json(edge);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Esos dos nodos ya están conectados.' });
    }
    console.error('Error en POST /grafo/edges:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// DELETE /api/grafo/edges/:id
// Marca como desactualizada cualquier ruta que haya usado esta
// conexión para generarse, y luego la elimina.
router.delete('/edges/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await marcarRutasDesactualizadasPorEdge(id);
    await prisma.edgeGrafo.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Conexión no encontrada.' });
  }
});

// POST /api/grafo/generar-ruta
// Calcula (sin guardar) el camino más corto entre un Qr y un Bloque o
// Espacio, y devuelve pasos de texto editables. Si no hay camino
// conectado en el grafo, devuelve 404 y no genera nada parcial.
router.post('/generar-ruta', async (req, res) => {
  const { qrId, bloqueId, espacioId } = req.body;

  if (!qrId || (!bloqueId && !espacioId) || (bloqueId && espacioId)) {
    return res.status(400).json({
      error: 'Se necesita un QR de origen y exactamente un destino (bloque o espacio).',
    });
  }

  try {
    const resultado = await generarRutaDesdeGrafo({
      qrId: Number(qrId),
      bloqueId: bloqueId ? Number(bloqueId) : undefined,
      espacioId: espacioId ? Number(espacioId) : undefined,
    });
    res.json(resultado);
  } catch (error) {
    if (error.noHayCamino) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error en POST /grafo/generar-ruta:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
