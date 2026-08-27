-- CreateEnum
CREATE TYPE "TipoNodoGrafo" AS ENUM ('QR', 'BLOQUE', 'ESPACIO', 'PASILLO', 'ESCALERA', 'ASCENSOR', 'PUERTA', 'PUNTO_REFERENCIA');

-- AlterTable: el destino de una Ruta ahora puede ser un Bloque (como
-- siempre) o un Espacio puntual (nuevo), nunca ambos a la vez. También
-- se agrega el snapshot del camino del grafo usado para generarla, y la
-- marca de "desactualizada" para el panel admin.
ALTER TABLE "rutas" ALTER COLUMN "bloqueId" DROP NOT NULL;
ALTER TABLE "rutas" ADD COLUMN     "espacioId" INTEGER,
ADD COLUMN     "nodosGrafoUsados" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "edgesGrafoUsados" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "desactualizada" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "nodos_grafo" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoNodoGrafo" NOT NULL,
    "etiqueta" TEXT,
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "piso" INTEGER,
    "pisoHasta" INTEGER,
    "qrId" INTEGER,
    "bloqueId" INTEGER,
    "espacioId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nodos_grafo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edges_grafo" (
    "id" SERIAL NOT NULL,
    "origenId" INTEGER NOT NULL,
    "destinoId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edges_grafo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rutas_qrId_espacioId_key" ON "rutas"("qrId", "espacioId");

-- CreateIndex
CREATE UNIQUE INDEX "nodos_grafo_qrId_key" ON "nodos_grafo"("qrId");

-- CreateIndex
CREATE UNIQUE INDEX "nodos_grafo_bloqueId_key" ON "nodos_grafo"("bloqueId");

-- CreateIndex
CREATE UNIQUE INDEX "nodos_grafo_espacioId_key" ON "nodos_grafo"("espacioId");

-- CreateIndex
CREATE UNIQUE INDEX "edges_grafo_origenId_destinoId_key" ON "edges_grafo"("origenId", "destinoId");

-- AddForeignKey
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodos_grafo" ADD CONSTRAINT "nodos_grafo_qrId_fkey" FOREIGN KEY ("qrId") REFERENCES "qrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodos_grafo" ADD CONSTRAINT "nodos_grafo_bloqueId_fkey" FOREIGN KEY ("bloqueId") REFERENCES "bloques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodos_grafo" ADD CONSTRAINT "nodos_grafo_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edges_grafo" ADD CONSTRAINT "edges_grafo_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "nodos_grafo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edges_grafo" ADD CONSTRAINT "edges_grafo_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "nodos_grafo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
