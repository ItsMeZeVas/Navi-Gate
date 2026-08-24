-- CreateEnum
CREATE TYPE "TipoEspacio" AS ENUM ('SALON', 'OFICINA', 'LABORATORIO', 'CAFETERIA', 'BANO', 'OTRO');

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qrs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloques" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rutas" (
    "id" TEXT NOT NULL,
    "qrId" TEXT NOT NULL,
    "bloqueId" TEXT NOT NULL,
    "instrucciones" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rutas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espacios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoEspacio" NOT NULL,
    "piso" INTEGER NOT NULL,
    "bloqueId" TEXT NOT NULL,
    "instruccionFinal" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "espacios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_usuario_key" ON "admins"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "qrs_slug_key" ON "qrs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rutas_qrId_bloqueId_key" ON "rutas"("qrId", "bloqueId");

-- CreateIndex
CREATE INDEX "espacios_bloqueId_piso_idx" ON "espacios"("bloqueId", "piso");

-- AddForeignKey
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_qrId_fkey" FOREIGN KEY ("qrId") REFERENCES "qrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_bloqueId_fkey" FOREIGN KEY ("bloqueId") REFERENCES "bloques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espacios" ADD CONSTRAINT "espacios_bloqueId_fkey" FOREIGN KEY ("bloqueId") REFERENCES "bloques"("id") ON DELETE CASCADE ON UPDATE CASCADE;
