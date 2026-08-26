const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/bloques   (protegido, uso del panel de administración)
router.get('/', requireAuth, async (req, res) => {
  const bloques = await prisma.bloque.findMany({
    include: { espacios: true, rutas: { include: { qr: true } } },
    orderBy: { nombre: 'asc' },
  });
  res.json(bloques);
});

// POST /api/bloques   (protegido)
router.post('/', requireAuth, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio.' });
  }
  const bloque = await prisma.bloque.create({ data: { nombre: nombre.trim() } });
  res.status(201).json(bloque);
});

// PATCH /api/bloques/:id   (protegido)
router.patch('/:id', requireAuth, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio.' });
  }
  try {
    const bloque = await prisma.bloque.update({
      where: { id: req.params.id },
      data: { nombre: nombre.trim() },
    });
    res.json(bloque);
  } catch (error) {
    res.status(404).json({ error: 'Bloque no encontrado.' });
  }
});

// DELETE /api/bloques/:id   (protegido)
// Ojo: borra en cascada sus Rutas y Espacios (definido en el schema).
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await prisma.bloque.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Bloque no encontrado.' });
  }
});

module.exports = router;
