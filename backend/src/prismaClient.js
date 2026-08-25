// Cliente único de Prisma, reutilizado en toda la app
// (evita abrir una conexión nueva por cada archivo que lo necesite).
//
// Desde Prisma 7, PrismaClient ya no se conecta solo con la
// DATABASE_URL del schema: hay que pasarle explícitamente un
// "driver adapter" (aquí, el de PostgreSQL).
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
