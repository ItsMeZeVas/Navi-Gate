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
  const { nombre, bloqueId } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio.' });
  }
  const slug = await slugDisponible(generarSlug(nombre));
  try {
    const qr = await prisma.qr.create({
      data: { nombre: nombre.trim(), slug, bloqueId: bloqueId ? Number(bloqueId) : null },
    });
    res.status(201).json(qr);
  } catch (error) {
    if (error.code === 'P2003') return res.status(400).json({ error: 'Ese bloque no existe.' });
    console.error('Error en POST /qr:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PATCH /api/qr/:id   (protegido)
// Se puede renombrar y/o indicar en qué bloque está el QR (bloqueId: null lo
// quita). El slug (la URL) no cambia una vez creado, para no invalidar
// códigos QR ya impresos.
router.patch('/:id', requireAuth, async (req, res) => {
  const { nombre, bloqueId } = req.body;
  const data = {};

  if (nombre !== undefined) {
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }
    data.nombre = nombre.trim();
  }
  if (bloqueId !== undefined) {
    data.bloqueId = bloqueId ? Number(bloqueId) : null;
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No hay nada que actualizar.' });
  }

  try {
    const qr = await prisma.qr.update({
      where: { id: Number(req.params.id) },
      data,
    });
    res.json(qr);
  } catch (error) {
    if (error.code === 'P2003') return res.status(400).json({ error: 'Ese bloque no existe.' });
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
// Cada acceso queda registrado en Escaneo (solo para estadísticas del
// panel admin); si ese registro falla por lo que sea, no debe tumbar
// la respuesta real al estudiante que está intentando llegar a algún lado.
router.get('/:slug', async (req, res) => {
  try {
    const qr = await prisma.qr.findUnique({
      where: { slug: req.params.slug },
      include: {
        nodoGrafo: true,
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

    prisma.escaneo.create({ data: { qrId: qr.id } }).catch((err) => {
      console.error('No se pudo registrar el escaneo (no afecta la respuesta):', err);
    });

    res.json(qr);
  } catch (error) {
    console.error('Error en GET /qr/:slug:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
