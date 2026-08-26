/*
  Warnings:

  - The primary key for the `admins` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `admins` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `bloques` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `bloques` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `espacios` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `espacios` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `qrs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `qrs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `rutas` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `rutas` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `bloqueId` on the `espacios` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `qrId` on the `rutas` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `bloqueId` on the `rutas` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "espacios" DROP CONSTRAINT "espacios_bloqueId_fkey";

-- DropForeignKey
ALTER TABLE "rutas" DROP CONSTRAINT "rutas_bloqueId_fkey";

-- DropForeignKey
ALTER TABLE "rutas" DROP CONSTRAINT "rutas_qrId_fkey";

-- AlterTable
ALTER TABLE "admins" DROP CONSTRAINT "admins_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "bloques" DROP CONSTRAINT "bloques_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "bloques_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "espacios" DROP CONSTRAINT "espacios_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "bloqueId",
ADD COLUMN     "bloqueId" INTEGER NOT NULL,
ADD CONSTRAINT "espacios_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "qrs" DROP CONSTRAINT "qrs_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "qrs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "rutas" DROP CONSTRAINT "rutas_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "qrId",
ADD COLUMN     "qrId" INTEGER NOT NULL,
DROP COLUMN "bloqueId",
ADD COLUMN     "bloqueId" INTEGER NOT NULL,
ADD CONSTRAINT "rutas_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "escaneos" (
    "id" SERIAL NOT NULL,
    "qrId" INTEGER NOT NULL,
    "escaneadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escaneos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "escaneos_qrId_idx" ON "escaneos"("qrId");

-- CreateIndex
CREATE INDEX "espacios_bloqueId_piso_idx" ON "espacios"("bloqueId", "piso");

-- CreateIndex
CREATE UNIQUE INDEX "rutas_qrId_bloqueId_key" ON "rutas"("qrId", "bloqueId");

-- AddForeignKey
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_qrId_fkey" FOREIGN KEY ("qrId") REFERENCES "qrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_bloqueId_fkey" FOREIGN KEY ("bloqueId") REFERENCES "bloques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espacios" ADD CONSTRAINT "espacios_bloqueId_fkey" FOREIGN KEY ("bloqueId") REFERENCES "bloques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escaneos" ADD CONSTRAINT "escaneos_qrId_fkey" FOREIGN KEY ("qrId") REFERENCES "qrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
