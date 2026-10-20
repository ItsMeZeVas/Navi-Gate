const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Dónde se guardan las imágenes:
//  - Con CLOUDINARY_URL definida (producción): en Cloudinary. Los hosts
//    gratuitos tienen disco efímero, así que guardar en disco perdería
//    las fotos cada vez que el servicio se reinicia o se duerme.
//  - Sin ella (desarrollo local): en la carpeta uploads/, como siempre.
const usaCloudinary = Boolean(process.env.CLOUDINARY_URL);
const cloudinary = usaCloudinary ? require('cloudinary').v2 : null;

const carpetaUploads = path.join(__dirname, '../../uploads');

const storage = usaCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, carpetaUploads),
      filename: (req, file, cb) => {
        const nombreUnico = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname)}`;
        cb(null, nombreUnico);
      },
    });

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo por imagen
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten archivos de imagen.'));
    }
    cb(null, true);
  },
});

// Sube el archivo (en memoria) a Cloudinary y devuelve su URL https.
// f_auto,q_auto le pide a Cloudinary el formato y la calidad más livianos
// para cada dispositivo, sin tocar la imagen original.
function subirACloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'navi-gate', resource_type: 'image' },
      (error, resultado) => {
        if (error) return reject(error);
        resolve(resultado.secure_url.replace('/upload/', '/upload/f_auto,q_auto/'));
      },
    );
    stream.end(buffer);
  });
}

// POST /api/uploads   (protegido)
// Recibe un archivo (campo "foto") y devuelve su URL: absoluta (https) si
// se guardó en Cloudinary, o relativa (/uploads/...) si se guardó en disco.
router.post('/', requireAuth, (req, res) => {
  upload.single('foto')(req, res, async (error) => {
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    if (usaCloudinary) {
      try {
        const url = await subirACloudinary(req.file.buffer);
        return res.status(201).json({ url });
      } catch (err) {
        console.error('Error subiendo a Cloudinary:', err);
        return res.status(502).json({ error: 'No se pudo guardar la imagen. Intenta de nuevo.' });
      }
    }

    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

module.exports = router;
