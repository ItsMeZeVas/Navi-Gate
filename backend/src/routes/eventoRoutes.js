const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const incluirSubEventos = {
  subEventos: {
    orderBy: { inicio: 'asc' },
    include: { espacio: { include: { bloque: true } } },
  },
};

function leerFecha(valor) {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function limpiarTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function leerId(valor) {
  const id = Number(valor);
  return Number.isInteger(id) ? id : null;
}

// Arma los datos comunes a Evento y SubEvento a partir del body.
// parcial=true (PATCH): solo valida/incluye los campos que llegaron.
function construirDatos(body, { parcial }) {
  const { nombre, descripcion, imagen, inicio, fin, visible } = body;
  const data = {};

  if (!parcial || nombre !== undefined) {
    const nombreLimpio = limpiarTexto(nombre);
    if (!nombreLimpio) return { error: 'El nombre es obligatorio.' };
    data.nombre = nombreLimpio;
  }
  if (descripcion !== undefined) data.descripcion = limpiarTexto(descripcion);
  if (imagen !== undefined) data.imagen = imagen ? String(imagen).trim() : null;

  if (!parcial || inicio !== undefined) {
    const fecha = leerFecha(inicio);
    if (!fecha) return { error: 'La fecha de inicio no es válida.' };
    data.inicio = fecha;
  }
  if (!parcial || fin !== undefined) {
    const fecha = leerFecha(fin);
    if (!fecha) return { error: 'La fecha de fin no es válida.' };
    data.fin = fecha;
  }
  if (visible !== undefined) data.visible = Boolean(visible);

  return { data };
}

// ---------------------------------------------------------------------
// GET /api/eventos/vigentes?qr=slug   (público)
// Eventos que están ocurriendo ahora mismo (visibles y entre su inicio y
// su fin), con sus sub-eventos que aún no terminaron. Si se manda el QR
// de origen, cada sub-evento indica si existe una ruta hasta su espacio
// (ruta directa al espacio o ruta a su bloque), para mostrar o no el
// botón "Cómo llegar".
// ---------------------------------------------------------------------
router.get('/vigentes', async (req, res) => {
  const { qr } = req.query;
  const ahora = new Date();

  try {
    const eventos = await prisma.evento.findMany({
      where: { visible: true, inicio: { lte: ahora }, fin: { gte: ahora } },
      orderBy: { inicio: 'asc' },
      include: {
        subEventos: {
          where: { visible: true, fin: { gte: ahora } },
          orderBy: { inicio: 'asc' },
          include: { espacio: { include: { bloque: true } } },
        },
      },
    });

    let rutas = [];
    if (qr) {
      const qrRecord = await prisma.qr.findUnique({
        where: { slug: String(qr) },
        include: { rutas: true },
      });
      rutas = qrRecord?.rutas ?? [];
    }

    const resultado = eventos.map((evento) => ({
      ...evento,
      subEventos: evento.subEventos.map((sub) => ({
        ...sub,
        tieneRuta:
          !!sub.espacio &&
          rutas.some((r) => r.espacioId === sub.espacio.id || r.bloqueId === sub.espacio.bloqueId),
      })),
    }));

    res.json(resultado);
  } catch (error) {
    console.error('Error en GET /eventos/vigentes:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------
// Todo lo demás es exclusivo del panel admin.
// ---------------------------------------------------------------------

// GET /api/eventos   (protegido) — todos los eventos con sus sub-eventos.
router.get('/', requireAuth, async (req, res) => {
  try {
    const eventos = await prisma.evento.findMany({
      orderBy: { inicio: 'desc' },
      include: incluirSubEventos,
    });
    res.json(eventos);
  } catch (error) {
    console.error('Error en GET /eventos:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/eventos   (protegido)
router.post('/', requireAuth, async (req, res) => {
  const { data, error } = construirDatos(req.body, { parcial: false });
  if (error) return res.status(400).json({ error });
  if (data.fin <= data.inicio) {
    return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la de inicio.' });
  }

  try {
    const evento = await prisma.evento.create({ data, include: incluirSubEventos });
    res.status(201).json(evento);
  } catch (err) {
    console.error('Error en POST /eventos:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PATCH /api/eventos/:id   (protegido) — admite cambios parciales
// (por ejemplo, solo { visible } para el interruptor de ocultar).
router.patch('/:id', requireAuth, async (req, res) => {
  const id = leerId(req.params.id);
  if (id === null) return res.status(404).json({ error: 'Evento no encontrado.' });

  const { data, error } = construirDatos(req.body, { parcial: true });
  if (error) return res.status(400).json({ error });

  try {
    const existente = await prisma.evento.findUnique({ where: { id } });
    if (!existente) return res.status(404).json({ error: 'Evento no encontrado.' });

    const inicioFinal = data.inicio ?? existente.inicio;
    const finFinal = data.fin ?? existente.fin;
    if (finFinal <= inicioFinal) {
      return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la de inicio.' });
    }

    const evento = await prisma.evento.update({ where: { id }, data, include: incluirSubEventos });
    res.json(evento);
  } catch (err) {
    console.error('Error en PATCH /eventos/:id:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// DELETE /api/eventos/:id   (protegido) — borra también sus sub-eventos.
router.delete('/:id', requireAuth, async (req, res) => {
  const id = leerId(req.params.id);
  if (id === null) return res.status(404).json({ error: 'Evento no encontrado.' });

  try {
    await prisma.evento.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Evento no encontrado.' });
  }
});

// POST /api/eventos/:id/sub-eventos   (protegido)
// Requiere espacioId: el lugar siempre es un Espacio ya registrado.
router.post('/:id/sub-eventos', requireAuth, async (req, res) => {
  const eventoId = leerId(req.params.id);
  if (eventoId === null) return res.status(404).json({ error: 'Evento no encontrado.' });

  const { data, error } = construirDatos(req.body, { parcial: false });
  if (error) return res.status(400).json({ error });
  if (data.fin <= data.inicio) {
    return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la de inicio.' });
  }

  const espacioId = leerId(req.body.espacioId);
  if (espacioId === null) {
    return res.status(400).json({ error: 'Elige el espacio donde se realiza el sub-evento.' });
  }

  try {
    const [evento, espacio] = await Promise.all([
      prisma.evento.findUnique({ where: { id: eventoId } }),
      prisma.espacio.findUnique({ where: { id: espacioId } }),
    ]);
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado.' });
    if (!espacio) return res.status(400).json({ error: 'Ese espacio no existe.' });

    const subEvento = await prisma.subEvento.create({
      data: { ...data, eventoId, espacioId },
      include: { espacio: { include: { bloque: true } } },
    });
    res.status(201).json(subEvento);
  } catch (err) {
    console.error('Error en POST /eventos/:id/sub-eventos:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PATCH /api/eventos/sub-eventos/:subId   (protegido)
router.patch('/sub-eventos/:subId', requireAuth, async (req, res) => {
  const id = leerId(req.params.subId);
  if (id === null) return res.status(404).json({ error: 'Sub-evento no encontrado.' });

  const { data, error } = construirDatos(req.body, { parcial: true });
  if (error) return res.status(400).json({ error });

  try {
    const existente = await prisma.subEvento.findUnique({ where: { id } });
    if (!existente) return res.status(404).json({ error: 'Sub-evento no encontrado.' });

    const inicioFinal = data.inicio ?? existente.inicio;
    const finFinal = data.fin ?? existente.fin;
    if (finFinal <= inicioFinal) {
      return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la de inicio.' });
    }

    if (req.body.espacioId !== undefined) {
      const espacioId = leerId(req.body.espacioId);
      if (espacioId === null) {
        return res.status(400).json({ error: 'Elige el espacio donde se realiza el sub-evento.' });
      }
      const espacio = await prisma.espacio.findUnique({ where: { id: espacioId } });
      if (!espacio) return res.status(400).json({ error: 'Ese espacio no existe.' });
      data.espacioId = espacioId;
    }

    const subEvento = await prisma.subEvento.update({
      where: { id },
      data,
      include: { espacio: { include: { bloque: true } } },
    });
    res.json(subEvento);
  } catch (err) {
    console.error('Error en PATCH /eventos/sub-eventos/:subId:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// DELETE /api/eventos/sub-eventos/:subId   (protegido)
router.delete('/sub-eventos/:subId', requireAuth, async (req, res) => {
  const id = leerId(req.params.subId);
  if (id === null) return res.status(404).json({ error: 'Sub-evento no encontrado.' });

  try {
    await prisma.subEvento.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Sub-evento no encontrado.' });
  }
});

module.exports = router;
