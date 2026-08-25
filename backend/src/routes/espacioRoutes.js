const express = require('express');
const Fuse = require('fuse.js');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/espacios?buscar=texto&piso=3&qr=slug
// Búsqueda pública de espacios. Si "buscar" no da una coincidencia
// exacta, se devuelven sugerencias parecidas (fuzzy match).
// Si se pasa "qr", cada espacio incluye la ruta desde ese QR hasta
// su bloque, lista para mostrar.
router.get('/', async (req, res) => {
  const { buscar, piso, qr, tipo, bloqueId } = req.query;

  try {
    const espacios = await prisma.espacio.findMany({
      where: {
        ...(piso ? { piso: Number(piso) } : {}),
        ...(tipo ? { tipo } : {}),
        ...(bloqueId ? { bloqueId } : {}),
      },
      include: { bloque: true },
      orderBy: { nombre: 'asc' },
    });

    let resultado = espacios;
    let exacto = true;

    if (buscar) {
      const coincidenciaExacta = espacios.filter((e) =>
        e.nombre.toLowerCase().includes(buscar.toLowerCase()),
      );

      if (coincidenciaExacta.length > 0) {
        resultado = coincidenciaExacta;
      } else {
        // Sin coincidencia exacta: usamos fuzzy search para sugerir parecidos.
        const fuse = new Fuse(espacios, { keys: ['nombre'], threshold: 0.4 });
        resultado = fuse.search(buscar).map((r) => r.item);
        exacto = false;
      }
    }

    // Si nos dieron un QR de origen, adjuntamos la ruta hacia el bloque de cada espacio.
    if (qr) {
      const qrRecord = await prisma.qr.findUnique({
        where: { slug: qr },
        include: { rutas: true },
      });

      resultado = resultado.map((espacio) => {
        const ruta = qrRecord?.rutas.find((r) => r.bloqueId === espacio.bloqueId);
        return { ...espacio, rutaDesdeQr: ruta ? ruta.instrucciones : null };
      });
    }

    res.json({ exacto, resultados: resultado });
  } catch (error) {
    console.error('Error en GET /espacios:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PATCH /api/espacios/:id   (protegido)
// Único campo editable por el admin: el nombre del espacio.
router.patch('/:id', requireAuth, async (req, res) => {
  const { nombre } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre no puede estar vacío.' });
  }

  try {
    const espacio = await prisma.espacio.update({
      where: { id: req.params.id },
      data: { nombre: nombre.trim() },
    });
    res.json(espacio);
  } catch (error) {
    console.error('Error en PATCH /espacios/:id:', error);
    res.status(404).json({ error: 'Espacio no encontrado.' });
  }
});

module.exports = router;
