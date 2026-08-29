const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/escaneos/resumen   (protegido)
// Estadísticas para el panel admin: totales, ranking de QRs más
// escaneados, y escaneos por día de los últimos 30 días (para un
// gráfico simple). Es de solo lectura: no afecta nada del resto de la app.
router.get('/resumen', requireAuth, async (req, res) => {
  try {
    const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, ultimos7dias, ultimos30dias, agrupadoPorQr, qrs, porDia] = await Promise.all([
      prisma.escaneo.count(),
      prisma.escaneo.count({ where: { escaneadoEn: { gte: hace7dias } } }),
      prisma.escaneo.count({ where: { escaneadoEn: { gte: hace30dias } } }),
      prisma.escaneo.groupBy({
        by: ['qrId'],
        _count: { qrId: true },
        orderBy: { _count: { qrId: 'desc' } },
      }),
      prisma.qr.findMany(),
      prisma.$queryRaw`
        SELECT date_trunc('day', "escaneadoEn") AS dia, COUNT(*)::int AS total
        FROM escaneos
        WHERE "escaneadoEn" >= ${hace30dias}
        GROUP BY dia
        ORDER BY dia ASC
      `,
    ]);

    const qrsPorId = new Map(qrs.map((qr) => [qr.id, qr]));
    const porQr = agrupadoPorQr
      .map((fila) => ({
        qrId: fila.qrId,
        nombre: qrsPorId.get(fila.qrId)?.nombre ?? 'QR eliminado',
        slug: qrsPorId.get(fila.qrId)?.slug ?? null,
        total: fila._count.qrId,
      }))
      .sort((a, b) => b.total - a.total);

    res.json({
      total,
      ultimos7dias,
      ultimos30dias,
      porQr,
      porDia: porDia.map((fila) => ({ fecha: fila.dia.toISOString().slice(0, 10), total: fila.total })),
    });
  } catch (error) {
    console.error('Error en GET /escaneos/resumen:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
