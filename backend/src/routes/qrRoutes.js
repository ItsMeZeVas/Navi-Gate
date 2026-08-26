const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Convierte "Entrada Principal" en "entrada-principal", quitando tildes.
function generarSlug(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function slugDisponible(base) {
  let slug = base;
  let sufijo = 2;
  while (await prisma.qr.findUnique({ where: { slug } })) {
    slug = `${base}-${sufijo}`;
    sufijo += 1;
  }
  return slug;
}

// GET /api/qr   (protegido, uso del panel de administración)
router.get('/', requireAuth, async (req, res) => {
  const qrs = await prisma.qr.findMany({ orderBy: { nombre: 'asc' } });
  res.json(qrs);
});

// POST /api/qr   (protegido)
router.post('/', requireAuth, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio.' });
  }
  const slug = await slugDisponible(generarSlug(nombre));
  const qr = await prisma.qr.create({ data: { nombre: nombre.trim(), slug } });
  res.status(201).json(qr);
});

// PATCH /api/qr/:id   (protegido)
// Solo se puede renombrar; el slug (la URL) no cambia una vez creado,
// para no invalidar códigos QR ya impresos.
router.patch('/:id', requireAuth, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio.' });
  }
  try {
    const qr = await prisma.qr.update({
      where: { id: Number(req.params.id) },
      data: { nombre: nombre.trim() },
    });
    res.json(qr);
  } catch (error) {
    res.status(404).json({ error: 'QR no encontrado.' });
  }
});

// DELETE /api/qr/:id   (protegido)
// Ojo: borra en cascada sus Rutas asociadas.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await prisma.qr.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'QR no encontrado.' });
  }
});

// GET /api/qr/:slug
// Info del QR escaneado: su nombre y las rutas que salen de él hacia
// cada bloque alcanzable (cada ruta trae el bloque y sus espacios).
router.get('/:slug', async (req, res) => {
  try {
    const qr = await prisma.qr.findUnique({
      where: { slug: req.params.slug },
      include: {
        rutas: {
          include: {
            bloque: {
              include: { espacios: true },
            },
          },
        },
      },
    });

    if (!qr) {
      return res.status(404).json({ error: 'No encontramos ese punto de partida.' });
    }

    res.json(qr);
  } catch (error) {
    console.error('Error en GET /qr/:slug:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
