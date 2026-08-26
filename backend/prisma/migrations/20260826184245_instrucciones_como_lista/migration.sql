/*
  Warnings:

  - The `instrucciones` column on the `rutas` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "rutas" DROP COLUMN "instrucciones",
ADD COLUMN     "instrucciones" TEXT[];
