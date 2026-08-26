const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/qr   (protegido, uso del panel de administración)
router.get('/', requireAuth, async (req, res) => {
  const qrs = await prisma.qr.findMany({ orderBy: { nombre: 'asc' } });
  res.json(qrs);
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
