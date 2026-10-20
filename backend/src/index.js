const express = require('express');
const path = require('path');
require('dotenv').config();

const { requireAuth } = require('./middleware/auth');
const adminRoutes = require('./routes/adminRoutes');
const qrRoutes = require('./routes/qrRoutes');
const espacioRoutes = require('./routes/espacioRoutes');
const bloqueRoutes = require('./routes/bloqueRoutes');
const rutaRoutes = require('./routes/rutaRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const grafoRoutes = require('./routes/grafoRoutes');
const escaneoRoutes = require('./routes/escaneoRoutes');
const eventoRoutes = require('./routes/eventoRoutes');

const app = express();

// Detrás del proxy de Render/Vercel, sin esto el rate limit del login ve a
// todos los usuarios como una sola IP y los bloquea juntos.
app.set('trust proxy', 1);

app.use(express.json());

// FRONTEND_URL (opcional, varias separadas por coma) limita qué sitios
// pueden llamar a la API desde un navegador. Si no se define (desarrollo
// local), se permite cualquier origen, como hasta ahora.
const origenesPermitidos = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);
app.use(require('cors')(origenesPermitidos.length ? { origin: origenesPermitidos } : undefined));

// Sirve las imágenes subidas (fotos de rutas y espacios) como archivos estáticos.
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', mensaje: 'Backend funcionando correctamente' });
});

app.use('/api/admin', adminRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/espacios', espacioRoutes);
app.use('/api/bloques', bloqueRoutes);
app.use('/api/rutas', rutaRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/grafo', grafoRoutes);
app.use('/api/escaneos', escaneoRoutes);
app.use('/api/eventos', eventoRoutes);

app.get('/api/admin/ping', requireAuth, (req, res) => {
  res.json({ mensaje: `Hola ${req.admin.usuario}, tu token es válido.` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend corriendo en el puerto ${PORT}`);
});
