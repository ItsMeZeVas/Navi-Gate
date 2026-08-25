const express = require('express');
require('dotenv').config();

const { requireAuth } = require('./middleware/auth');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
app.use(express.json());
app.use(require('cors')());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', mensaje: 'Backend funcionando correctamente' });
});

app.use('/api/admin', adminRoutes);

// Ruta de prueba temporal para confirmar que el middleware protege bien.
// La quitamos (o la reemplazamos por rutas reales) en el siguiente paso.
app.get('/api/admin/ping', requireAuth, (req, res) => {
  res.json({ mensaje: `Hola ${req.admin.usuario}, tu token es válido.` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend corriendo en el puerto ${PORT}`);
});
