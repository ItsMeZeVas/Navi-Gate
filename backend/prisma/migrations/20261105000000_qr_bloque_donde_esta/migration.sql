-- AlterTable: un QR puede indicar en qué bloque está físicamente pegado.
ALTER TABLE "qrs" ADD COLUMN     "bloqueId" INTEGER;

-- AddForeignKey: si se borra el bloque, el QR se conserva y queda sin bloque.
ALTER TABLE "qrs" ADD CONSTRAINT "qrs_bloqueId_fkey" FOREIGN KEY ("bloqueId") REFERENCES "bloques"("id") ON DELETE SET NULL ON UPDATE CASCADE;
