const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/rutas   (protegido)
router.get('/', requireAuth, async (req, res) => {
  const rutas = await prisma.ruta.findMany({
    include: { qr: true, bloque: true, espacio: true, nodoGrafo: true },
    orderBy: { creadoEn: 'desc' },
  });
  res.json(rutas);
});

// POST /api/rutas   (protegido)
// Conecta un QR de origen con UN destino: un Bloque, un Espacio o un punto
// del grafo (nunca más de uno). El flujo manual de siempre solo manda
// bloqueId, igual que antes; el grafo de mapeo puede mandar además
// espacioId o nodoGrafoId, y opcionalmente
// nodosGrafoUsados/edgesGrafoUsados (el "snapshot" del camino que usó
// para generarla, solo para poder detectar después si quedó desactualizada).
// Si ya existe una ruta para ese QR y ese destino, por defecto se rechaza
// (409); si el body manda reemplazar:true, esa ruta existente se sobrescribe.
router.post('/', requireAuth, async (req, res) => {
  const {
    qrId,
    bloqueId,
    espacioId,
    nodoGrafoId,
    instrucciones,
    fotos,
    nodosGrafoUsados,
    edgesGrafoUsados,
    reemplazar,
  } = req.body;

  const pasos = Array.isArray(instrucciones)
    ? instrucciones.map((p) => p.trim()).filter(Boolean)
    : [];
  const listaFotos = Array.isArray(fotos) ? fotos.map((f) => f.trim()).filter(Boolean) : [];

  const destinosIndicados = [bloqueId, espacioId, nodoGrafoId].filter(Boolean).length;
  if (!qrId || destinosIndicados !== 1 || pasos.length === 0) {
    return res.status(400).json({
      error:
        'qrId, exactamente un destino (bloqueId, espacioId o nodoGrafoId) y al menos una instrucción son obligatorios.',
    });
  }

  const snapshotNodos = Array.isArray(nodosGrafoUsados) ? nodosGrafoUsados.map(Number) : [];
  const datosComunes = {
    instrucciones: pasos,
    fotos: listaFotos,
    nodosGrafoUsados: snapshotNodos,
    edgesGrafoUsados: Array.isArray(edgesGrafoUsados) ? edgesGrafoUsados.map(Number) : [],
    desactualizada: false,
    // Una ruta generada desde el grafo (trae el camino que usó) ya está
    // reflejada en el grafo: no debe volver a "ofrecerse" como una conexión
    // directa Qr→Bloque, que crearía un atajo falso en el mapa.
    edgeGrafoSincronizado: snapshotNodos.length > 0,
  };
  const destino = {
    bloqueId: bloqueId ? Number(bloqueId) : null,
    espacioId: espacioId ? Number(espacioId) : null,
    nodoGrafoId: nodoGrafoId ? Number(nodoGrafoId) : null,
  };

  try {
    let ruta;
    if (reemplazar) {
      let whereUnico;
      if (bloqueId) whereUnico = { qrId_bloqueId: { qrId: Number(qrId), bloqueId: Number(bloqueId) } };
      else if (espacioId) whereUnico = { qrId_espacioId: { qrId: Number(qrId), espacioId: Number(espacioId) } };
      else whereUnico = { qrId_nodoGrafoId: { qrId: Number(qrId), nodoGrafoId: Number(nodoGrafoId) } };

      ruta = await prisma.ruta.upsert({
        where: whereUnico,
        create: {
          qrId: Number(qrId),
          ...destino,
          ...datosComunes,
        },
        update: datosComunes,
        include: { qr: true, bloque: true, espacio: true, nodoGrafo: true },
      });
    } else {
      ruta = await prisma.ruta.create({
        data: {
          qrId: Number(qrId),
          ...destino,
          ...datosComunes,
        },
        include: { qr: true, bloque: true, espacio: true, nodoGrafo: true },
      });
    }
    res.status(201).json(ruta);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una ruta entre ese QR y ese destino.' });
    }
    console.error('Error en POST /rutas:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PATCH /api/rutas/:id   (protegido)
// Solo se puede editar la lista de instrucciones (no el QR, el bloque
// ni el espacio: si cambian, es más claro borrar y crear una ruta nueva).
// Guardar una edición también limpia la marca de "desactualizada": el
// admin acaba de revisar y confirmar el contenido de la ruta.
router.patch('/:id', requireAuth, async (req, res) => {
  const { instrucciones, fotos } = req.body;

  const pasos = Array.isArray(instrucciones)
    ? instrucciones.map((p) => p.trim()).filter(Boolean)
    : [];

  if (pasos.length === 0) {
    return res.status(400).json({ error: 'Debe haber al menos una instrucción.' });
  }

  const data = { instrucciones: pasos, desactualizada: false };
  if (Array.isArray(fotos)) {
    data.fotos = fotos.map((f) => f.trim()).filter(Boolean);
  }

  try {
    const ruta = await prisma.ruta.update({
      where: { id: Number(req.params.id) },
      data,
      include: { qr: true, bloque: true, espacio: true, nodoGrafo: true },
    });
    res.json(ruta);
  } catch (error) {
    res.status(404).json({ error: 'Ruta no encontrada.' });
  }
});

// DELETE /api/rutas/:id   (protegido)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await prisma.ruta.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Ruta no encontrada.' });
  }
});

module.exports = router;
