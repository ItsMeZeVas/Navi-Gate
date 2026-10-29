-- AlterTable: los puntos intermedios del grafo pueden marcarse como visibles
-- en la app pública (y recibir rutas generadas hacia ellos).
ALTER TABLE "nodos_grafo" ADD COLUMN     "visibleEnApp" BOOLEAN NOT NULL DEFAULT false;

-- Por defecto: visibles los puntos de referencia, ascensores y escaleras que
-- ya existan; pasillos y puertas quedan apagados (se pueden cambiar desde el panel).
UPDATE "nodos_grafo" SET "visibleEnApp" = true
WHERE "tipo" IN ('PUNTO_REFERENCIA', 'ESCALERA', 'ASCENSOR');

-- AlterTable: una Ruta también puede tener como destino un punto del grafo.
ALTER TABLE "rutas" ADD COLUMN     "nodoGrafoId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "rutas_qrId_nodoGrafoId_key" ON "rutas"("qrId", "nodoGrafoId");

-- AddForeignKey
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_nodoGrafoId_fkey" FOREIGN KEY ("nodoGrafoId") REFERENCES "nodos_grafo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
