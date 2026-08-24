-- CreateTable
CREATE TABLE "escaneos" (
    "id" TEXT NOT NULL,
    "qrId" TEXT NOT NULL,
    "escaneadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escaneos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "escaneos_qrId_idx" ON "escaneos"("qrId");

-- AddForeignKey
ALTER TABLE "escaneos" ADD CONSTRAINT "escaneos_qrId_fkey" FOREIGN KEY ("qrId") REFERENCES "qrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
