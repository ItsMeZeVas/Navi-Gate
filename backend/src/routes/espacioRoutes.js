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
        ...(bloqueId ? { bloqueId: Number(bloqueId) } : {}),
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

    // Si nos dieron un QR de origen, adjuntamos la ruta hacia cada espacio.
    // Si existe una ruta específica hasta ese Espacio (normalmente generada
    // con el grafo de mapeo), esa gana; si no, cae a la ruta de su Bloque
    // (el comportamiento de siempre).
    if (qr) {
      const qrRecord = await prisma.qr.findUnique({
        where: { slug: qr },
        include: { rutas: true },
      });

      resultado = resultado.map((espacio) => {
        const rutaEspacio = qrRecord?.rutas.find((r) => r.espacioId === espacio.id);
        const rutaBloque = qrRecord?.rutas.find((r) => r.bloqueId === espacio.bloqueId);
        const ruta = rutaEspacio || rutaBloque;
        return {
          ...espacio,
          rutaDesdeQr: ruta ? ruta.instrucciones : null,
          rutaFotos: ruta ? ruta.fotos : [],
        };
      });
    }

    res.json({ exacto, resultados: resultado });
  } catch (error) {
    console.error('Error en GET /espacios:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/espacios   (protegido)
router.post('/', requireAuth, async (req, res) => {
  const { nombre, tipo, piso, bloqueId, instruccionFinal, fotos } = req.body;

  if (!nombre || !tipo || piso === undefined || !bloqueId || !instruccionFinal) {
    return res.status(400).json({ error: 'nombre, tipo, piso, bloqueId e instruccionFinal son obligatorios.' });
  }

  const listaFotos = Array.isArray(fotos) ? fotos.map((f) => f.trim()).filter(Boolean) : [];

  try {
    const espacio = await prisma.espacio.create({
      data: {
        nombre: nombre.trim(),
        tipo,
        piso: Number(piso),
        bloqueId: Number(bloqueId),
        instruccionFinal: instruccionFinal.trim(),
        fotos: listaFotos,
      },
      include: { bloque: true },
    });
    res.status(201).json(espacio);
  } catch (error) {
    console.error('Error en POST /espacios:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PATCH /api/espacios/:id   (protegido)
// Permite editar cualquier campo del espacio (nombre, tipo, piso,
// bloque, instrucción final).
router.patch('/:id', requireAuth, async (req, res) => {
  const { nombre, tipo, piso, bloqueId, instruccionFinal, fotos } = req.body;

  if (nombre !== undefined && !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre no puede estar vacío.' });
  }

  const data = {};
  if (nombre !== undefined) data.nombre = nombre.trim();
  if (tipo !== undefined) data.tipo = tipo;
  if (piso !== undefined) data.piso = Number(piso);
  if (bloqueId !== undefined) data.bloqueId = Number(bloqueId);
  if (instruccionFinal !== undefined) data.instruccionFinal = instruccionFinal.trim();
  if (Array.isArray(fotos)) data.fotos = fotos.map((f) => f.trim()).filter(Boolean);

  try {
    const espacio = await prisma.espacio.update({
      where: { id: Number(req.params.id) },
      data,
      include: { bloque: true },
    });
    res.json(espacio);
  } catch (error) {
    console.error('Error en PATCH /espacios/:id:', error);
    res.status(404).json({ error: 'Espacio no encontrado.' });
  }
});

// DELETE /api/espacios/:id   (protegido)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await prisma.espacio.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Espacio no encontrado.' });
  }
});

module.exports = router;
