const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

const router = express.Router();

// POST /api/admin/login
// Recibe { usuario, password } y devuelve un JWT si son correctos.
// No hay endpoint de registro: los admins se crean con el seed script.
router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
  }

  try {
    const admin = await prisma.admin.findUnique({ where: { usuario } });

    // Mismo mensaje de error tanto si el usuario no existe como si la
    // contraseña es incorrecta, para no revelar cuáles usuarios existen.
    if (!admin) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const passwordValida = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const token = jwt.sign(
      { adminId: admin.id, usuario: admin.usuario },
      process.env.JWT_SECRET,
      { expiresIn: '8h' },
    );

    res.json({ token });
  } catch (error) {
    console.error('Error en /admin/login:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
