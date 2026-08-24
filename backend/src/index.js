const express = require('express');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(require('cors')());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', mensaje: 'Backend funcionando correctamente' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend corriendo en el puerto ${PORT}`);
});