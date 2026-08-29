// Cambia la contraseña de un admin existente (o crea uno nuevo si el
// usuario no existe todavía). Uso, desde dentro del contenedor backend:
//
//   node scripts/cambiar-password.js admin "mi-nueva-clave-segura"
//
// o en un solo paso desde afuera:
//
//   docker compose exec backend node scripts/cambiar-password.js admin "mi-nueva-clave-segura"

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [usuario, nuevaPassword] = process.argv.slice(2);

  if (!usuario || !nuevaPassword) {
    console.error('Uso: node scripts/cambiar-password.js <usuario> <nueva-contraseña>');
    process.exit(1);
  }
  if (nuevaPassword.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(nuevaPassword, 10);

  const admin = await prisma.admin.upsert({
    where: { usuario },
    update: { passwordHash },
    create: { usuario, passwordHash },
  });

  console.log(`Contraseña actualizada para "${admin.usuario}".`);
}

main()
  .catch((error) => {
    console.error('Error cambiando la contraseña:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
