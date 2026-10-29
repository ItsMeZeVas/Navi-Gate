const express = require('express');
const prisma = require('../prismaClient');

const router = express.Router();

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// GET /api/puntos?qr=slug&buscar=texto   (público)
// Puntos del grafo marcados como "Visible en la app" (puntos de referencia,
// ascensores, escaleras…) que se pueden buscar como destino. Con "qr", solo
// se devuelven los que tienen ruta desde ese QR (así nunca se lleva a la
// persona a un destino sin instrucciones), y cada uno trae su ruta.
router.get('/', async (req, res) => {
  const { qr, buscar } = req.query;

  try {
    const nodos = await prisma.nodoGrafo.findMany({
      where: { visibleEnApp: true, qrId: null, bloqueId: null, espacioId: null },
      orderBy: { etiqueta: 'asc' },
    });

    let rutas = [];
    if (qr) {
      const qrRecord = await prisma.qr.findUnique({
        where: { slug: String(qr) },
        include: { rutas: { where: { nodoGrafoId: { not: null } } } },
      });
      rutas = qrRecord?.rutas ?? [];
    }

    const texto = normalizar(buscar);
    let resultado = nodos
      .filter((nodo) => !texto || normalizar(nodo.etiqueta).includes(texto))
      .map((nodo) => {
        const ruta = rutas.find((r) => r.nodoGrafoId === nodo.id);
        return {
          id: nodo.id,
          nombre: nodo.etiqueta,
          tipo: nodo.tipo,
          piso: nodo.piso,
          pisoHasta: nodo.pisoHasta,
          rutaDesdeQr: ruta ? ruta.instrucciones : null,
          rutaFotos: ruta ? ruta.fotos : [],
        };
      });

    if (qr) resultado = resultado.filter((punto) => punto.rutaDesdeQr);

    res.json(resultado);
  } catch (error) {
    console.error('Error en GET /puntos:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
