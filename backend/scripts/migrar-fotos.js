// Migra a Cloudinary las fotos que se subieron en desarrollo (carpeta
// backend/uploads) y reescribe en la base de datos las URLs que apuntaban
// a /uploads/... (rutas, espacios, eventos y sub-eventos).
//
// Úsalo una sola vez, después de restaurar tu base local en Neon. Es seguro
// repetirlo: solo toca URLs que apunten a /uploads/ y sube cada foto una vez.
//
//   docker compose exec -e DATABASE_URL="<url de Neon>" -e CLOUDINARY_URL="<url de Cloudinary>" \
//     backend node scripts/migrar-fotos.js

const fs = require('fs');
const path = require('path');

const carpetaUploads = path.join(__dirname, '../uploads');

// "http://localhost:3000/uploads/abc.jpg" o "/uploads/abc.jpg" -> "abc.jpg"
function nombreArchivoLocal(url) {
  if (typeof url !== 'string') return null;
  const coincidencia = url.match(/^(?:https?:\/\/[^/]+)?\/uploads\/([^/?#]+)$/);
  return coincidencia ? coincidencia[1] : null;
}

function reemplazarUrl(url, mapa) {
  const nombre = nombreArchivoLocal(url);
  return nombre && mapa.has(nombre) ? mapa.get(nombre) : url;
}

async function main() {
  if (!process.env.CLOUDINARY_URL || !process.env.DATABASE_URL) {
    console.error('Faltan variables: define DATABASE_URL (Neon) y CLOUDINARY_URL.');
    process.exit(1);
  }

  const cloudinary = require('cloudinary').v2;
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    const [rutas, espacios, eventos, subEventos] = await Promise.all([
      prisma.ruta.findMany({ select: { id: true, fotos: true } }),
      prisma.espacio.findMany({ select: { id: true, fotos: true } }),
      prisma.evento.findMany({ select: { id: true, imagen: true } }),
      prisma.subEvento.findMany({ select: { id: true, imagen: true } }),
    ]);

    const referenciadas = new Set();
    const recolectar = (url) => {
      const nombre = nombreArchivoLocal(url);
      if (nombre) referenciadas.add(nombre);
    };
    rutas.forEach((r) => r.fotos.forEach(recolectar));
    espacios.forEach((e) => e.fotos.forEach(recolectar));
    eventos.forEach((e) => recolectar(e.imagen));
    subEventos.forEach((s) => recolectar(s.imagen));

    if (referenciadas.size === 0) {
      console.log('No hay fotos locales que migrar.');
      return;
    }

    console.log(`Subiendo ${referenciadas.size} foto(s) a Cloudinary…`);
    const mapa = new Map();
    for (const nombre of referenciadas) {
      const archivo = path.join(carpetaUploads, nombre);
      if (!fs.existsSync(archivo)) {
        console.warn(`  ! ${nombre}: la base la menciona pero no existe en backend/uploads; se omite.`);
        continue;
      }
      const resultado = await cloudinary.uploader.upload(archivo, {
        folder: 'navi-gate',
        public_id: path.parse(nombre).name,
        overwrite: true,
        resource_type: 'image',
      });
      mapa.set(nombre, resultado.secure_url.replace('/upload/', '/upload/f_auto,q_auto/'));
      console.log(`  ✓ ${nombre}`);
    }

    let registros = 0;
    const cambioEnLista = (lista) => lista.map((u) => reemplazarUrl(u, mapa));
    const huboCambio = (antes, despues) => despues.some((u, i) => u !== antes[i]);

    for (const r of rutas) {
      const fotos = cambioEnLista(r.fotos);
      if (huboCambio(r.fotos, fotos)) {
        await prisma.ruta.update({ where: { id: r.id }, data: { fotos } });
        registros += 1;
      }
    }
    for (const e of espacios) {
      const fotos = cambioEnLista(e.fotos);
      if (huboCambio(e.fotos, fotos)) {
        await prisma.espacio.update({ where: { id: e.id }, data: { fotos } });
        registros += 1;
      }
    }
    for (const e of eventos) {
      const imagen = reemplazarUrl(e.imagen, mapa);
      if (imagen !== e.imagen) {
        await prisma.evento.update({ where: { id: e.id }, data: { imagen } });
        registros += 1;
      }
    }
    for (const s of subEventos) {
      const imagen = reemplazarUrl(s.imagen, mapa);
      if (imagen !== s.imagen) {
        await prisma.subEvento.update({ where: { id: s.id }, data: { imagen } });
        registros += 1;
      }
    }

    console.log(`Listo: ${mapa.size} foto(s) subidas, ${registros} registro(s) actualizados.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error migrando las fotos:', error);
    process.exit(1);
  });
}

module.exports = { nombreArchivoLocal, reemplazarUrl };
