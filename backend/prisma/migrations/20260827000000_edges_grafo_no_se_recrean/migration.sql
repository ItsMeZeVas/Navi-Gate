-- AlterTable: marca de una sola vía para que el grafo de mapeo no
-- vuelva a crear una conexión implícita (Qr→Bloque) que el admin ya
-- borró a mano.
ALTER TABLE "rutas" ADD COLUMN     "edgeGrafoSincronizado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: lo mismo, para la conexión implícita Espacio→Bloque.
ALTER TABLE "espacios" ADD COLUMN     "edgeGrafoSincronizado" BOOLEAN NOT NULL DEFAULT false;
