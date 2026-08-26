const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/rutas   (protegido)
router.get('/', requireAuth, async (req, res) => {
  const rutas = await prisma.ruta.findMany({
    include: { qr: true, bloque: true },
    orderBy: { creadoEn: 'desc' },
  });
  res.json(rutas);
});

// POST /api/rutas   (protegido)
// Conecta un QR de origen con un Bloque de destino.
router.post('/', requireAuth, async (req, res) => {
  const { qrId, bloqueId, instrucciones } = req.body;

  const pasos = Array.isArray(instrucciones)
    ? instrucciones.map((p) => p.trim()).filter(Boolean)
    : [];

  if (!qrId || !bloqueId || pasos.length === 0) {
    return res.status(400).json({ error: 'qrId, bloqueId y al menos una instrucción son obligatorios.' });
  }

  try {
    const ruta = await prisma.ruta.create({
      data: { qrId: Number(qrId), bloqueId: Number(bloqueId), instrucciones: pasos },
      include: { qr: true, bloque: true },
    });
    res.status(201).json(ruta);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una ruta entre ese QR y ese bloque.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PATCH /api/rutas/:id   (protegido)
// Solo se puede editar la lista de instrucciones (no el QR ni el bloque:
// si cambian, es más claro borrar y crear una ruta nueva).
router.patch('/:id', requireAuth, async (req, res) => {
  const { instrucciones } = req.body;

  const pasos = Array.isArray(instrucciones)
    ? instrucciones.map((p) => p.trim()).filter(Boolean)
    : [];

  if (pasos.length === 0) {
    return res.status(400).json({ error: 'Debe haber al menos una instrucción.' });
  }

  try {
    const ruta = await prisma.ruta.update({
      where: { id: Number(req.params.id) },
      data: { instrucciones: pasos },
      include: { qr: true, bloque: true },
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
