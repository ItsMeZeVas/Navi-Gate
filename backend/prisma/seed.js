// Seed de Navi-Gate.
// Crea el primer admin (login manual, sin registro público) y un
// conjunto de datos de ejemplo para probar el flujo completo.
//
// Se ejecuta con: docker compose exec backend npx prisma migrate dev
// (Prisma corre el seed automáticamente tras cada migración si la
// base de datos estaba vacía), o manualmente con:
// docker compose exec backend npx prisma db seed

const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- Admin ---
  const passwordHash = await bcrypt.hash("cambiar-esta-clave", 10);

  const admin = await prisma.admin.upsert({
    where: { usuario: "admin" },
    update: {},
    create: { usuario: "admin", passwordHash },
  });
  console.log(`Admin listo: ${admin.usuario}`);

  // --- QR de ejemplo: entrada principal ---
  const qrEntrada = await prisma.qr.upsert({
    where: { slug: "entrada-principal" },
    update: {},
    create: { slug: "entrada-principal", nombre: "Entrada Principal" },
  });

  // --- Bloque de ejemplo ---
  // Como el id ahora es autoincremental (no se puede fijar a mano),
  // buscamos por nombre para que el seed siga siendo idempotente.
  let bloqueC = await prisma.bloque.findFirst({ where: { nombre: "Bloque C" } });
  if (!bloqueC) {
    bloqueC = await prisma.bloque.create({ data: { nombre: "Bloque C" } });
  }

  // --- Ruta QR -> Bloque ---
  await prisma.ruta.upsert({
    where: { qrId_bloqueId: { qrId: qrEntrada.id, bloqueId: bloqueC.id } },
    update: {},
    create: {
      qrId: qrEntrada.id,
      bloqueId: bloqueC.id,
      instrucciones: ["Camina hacia el Bloque C.", "Sube al segundo piso y luego al tercero."],
    },
  });

  // --- Espacios dentro del Bloque C ---
  const c307 = await prisma.espacio.findFirst({
    where: { nombre: "C307", bloqueId: bloqueC.id },
  });
  if (!c307) {
    await prisma.espacio.create({
      data: {
        nombre: "C307",
        tipo: "SALON",
        piso: 3,
        bloqueId: bloqueC.id,
        instruccionFinal: "En el tercer piso, tercera puerta a la derecha.",
      },
    });
  }

  const cafeteria = await prisma.espacio.findFirst({
    where: { nombre: "Cafetería Bloque C", bloqueId: bloqueC.id },
  });
  if (!cafeteria) {
    await prisma.espacio.create({
      data: {
        nombre: "Cafetería Bloque C",
        tipo: "CAFETERIA",
        piso: 1,
        bloqueId: bloqueC.id,
        instruccionFinal: "En el primer piso, al fondo a la izquierda.",
      },
    });
  }

  console.log("Seed completado.");
}

main()
  .catch((error) => {
    console.error("Error corriendo el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
