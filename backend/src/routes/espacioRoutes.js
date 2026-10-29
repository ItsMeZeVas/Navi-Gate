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
const TIPOS_ESPACIO = ['SALON', 'OFICINA', 'LABORATORIO', 'CAFETERIA', 'BANO', 'OTRO'];
const NOMBRE_BASE_POR_TIPO = {
  SALON: 'Salón',
  OFICINA: 'Oficina',
  LABORATORIO: 'Laboratorio',
  CAFETERIA: 'Cafetería',
  BANO: 'Baño',
  OTRO: 'Espacio',
};
const MAXIMO_POR_LOTE = 200;

// POST /api/espacios/lote   (protegido)
// Crea varios espacios de una vez: { bloqueId, piso, tipo, prefijo, desde, hasta }.
// Ej.: bloque A, piso 2, SALON, prefijo "A", 201 a 215 -> "Salón A201" … "Salón A215".
// Los que ya existan en ese bloque (mismo nombre) se omiten; se crea el resto.
router.post('/lote', requireAuth, async (req, res) => {
  const { bloqueId, piso, tipo, prefijo, desde, hasta } = req.body;

  const bloque = Number(bloqueId);
  const pisoNumero = Number(piso);
  const inicio = Number(desde);
  const fin = Number(hasta);

  if (!Number.isInteger(bloque) || !Number.isInteger(pisoNumero)) {
    return res.status(400).json({ error: 'Elige el bloque y el piso.' });
  }
  if (!TIPOS_ESPACIO.includes(tipo)) {
    return res.status(400).json({ error: 'El tipo de espacio no es válido.' });
  }
  if (!Number.isInteger(inicio) || !Number.isInteger(fin) || inicio < 0 || fin < inicio) {
    return res.status(400).json({ error: 'El rango no es válido: "desde" debe ser un número menor o igual a "hasta".' });
  }
  if (fin - inicio + 1 > MAXIMO_POR_LOTE) {
    return res.status(400).json({ error: `Máximo ${MAXIMO_POR_LOTE} espacios por lote.` });
  }

  const textoPrefijo = typeof prefijo === 'string' ? prefijo.trim() : '';

  try {
    const bloqueExiste = await prisma.bloque.findUnique({ where: { id: bloque } });
    if (!bloqueExiste) return res.status(400).json({ error: 'Ese bloque no existe.' });

    const nombres = [];
    for (let numero = inicio; numero <= fin; numero += 1) {
      nombres.push(`${NOMBRE_BASE_POR_TIPO[tipo]} ${textoPrefijo}${numero}`);
    }

    const existentes = await prisma.espacio.findMany({
      where: { bloqueId: bloque },
      select: { nombre: true },
    });
    const yaExisten = new Set(existentes.map((e) => e.nombre.trim().toLowerCase()));

    const crear = nombres.filter((n) => !yaExisten.has(n.toLowerCase()));
    const omitidos = nombres.filter((n) => yaExisten.has(n.toLowerCase()));

    if (crear.length > 0) {
      await prisma.espacio.createMany({
        data: crear.map((nombre) => ({
          nombre,
          tipo,
          piso: pisoNumero,
          bloqueId: bloque,
          // La instrucción final es obligatoria; esta es la de partida y
          // se puede editar después, espacio por espacio.
          instruccionFinal: `Piso ${pisoNumero}, ${nombre}`,
          fotos: [],
        })),
      });
    }

    res.status(201).json({ creados: crear, omitidos });
  } catch (error) {
    console.error('Error en POST /espacios/lote:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

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
