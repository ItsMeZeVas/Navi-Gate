# Navi-Gate

Herramienta web para guiar a estudiantes dentro del campus universitario a través de códigos QR fijos: al escanear un QR ubicado en un punto físico, el usuario busca un espacio (salón, oficina, laboratorio, cafetería, baño, etc.) y recibe instrucciones de cómo llegar desde ese punto.

Incluye un panel de administración con login (JWT) para renombrar espacios sin afectar las rutas cargadas.

## Modelo de datos

- **Qr** — punto físico donde está pegado un código QR (identificado por `slug` único en la URL, ej. `/qr/entrada-principal`).
- **Bloque** — edificio o zona del campus. Agrupa uno o varios espacios.
- **Ruta** — instrucciones de texto para llegar desde un `Qr` (origen) hasta un `Bloque` **o** un `Espacio` (destino, nunca ambos). La mayoría se cargan a mano; también se pueden generar automáticamente desde el grafo de mapeo (ver abajo). Una sola ruta por combinación QR-Bloque, y una sola por combinación QR-Espacio.
- **Espacio** — salón, oficina, laboratorio, cafetería, baño, etc. (`enum TipoEspacio`), con `nombre` editable por el admin, `piso`, e `instruccionFinal` (detalle dentro del bloque). Renombrar un espacio nunca afecta la ruta ni la instrucción final.
- **Admin** — usuario del panel de administración. Se crea manualmente vía seed, sin registro público.
- **NodoGrafo / EdgeGrafo** — grafo opcional de mapeo del campus (ver abajo). No afecta el modelo anterior si nunca se usa.

## Grafo de mapeo (generación automática de rutas)

Pestaña "Grafo" del panel admin: alternativa visual a escribir rutas a mano.

- Cada `Qr`, `Bloque` y `Espacio` aparece como un nodo del grafo automáticamente (junto con las conexiones que ya existan: `Espacio → su Bloque`, y `Qr → Bloque` por cada `Ruta` manual ya cargada). El admin puede además agregar nodos intermedios (pasillo, escalera, ascensor, puerta, punto de referencia) y conectarlos arrastrando entre nodos.
- Las escaleras y ascensores pueden abarcar un rango de piso (`piso` → `pisoHasta`) en un solo nodo.
- El grafo es acumulativo: lo que el admin arma queda guardado y se sigue completando con el tiempo, no se reinicia cada vez.
- Botón "Generar camino": calcula el camino más corto (menos saltos, BFS) entre un `Qr` de origen y un `Bloque` o `Espacio` de destino, y arma los pasos de texto automáticamente según el tipo de cada nodo del camino. Si el grafo no los conecta, no genera nada y muestra un error — nunca guarda una ruta incompleta.
- Los pasos generados son editables antes y después de guardarse, igual que una ruta manual.
- Si luego se borra un nodo o conexión que una ruta generada usó, esa ruta se marca como "desactualizada" (solo visible en el panel admin); guardar una edición sobre ella limpia la marca.
- Un nodo o conexión que el admin borra a mano se queda borrado para siempre; el grafo nunca "revive" solo una conexión automática que ya fue borrada.
- La pestaña incluye filtros puramente visuales (no tocan la base de datos): por tipo de nodo, y por QR (muestra solo lo alcanzable desde el QR elegido).

## Estadísticas de escaneos

Pestaña "Estadísticas" del panel admin: cada vez que alguien abre la app desde un QR (`GET /api/qr/:slug`), queda un registro en `Escaneo`. El panel muestra el total, los últimos 7/30 días, un gráfico simple de escaneos por día, y un ranking de los QRs más usados — útil para decidir dónde conviene agregar QRs nuevos. Es de solo lectura y no afecta el resto de la app; si el registro de un escaneo falla por lo que sea, no bloquea la respuesta al estudiante.

## Preparar para producción

- **URL de los QRs:** por defecto, cada QR se genera con la URL desde donde abriste el panel admin (`window.location.origin`), lo cual sirve para probar en desarrollo pero **no** para QRs impresos de verdad — `localhost` en tu computador no es lo mismo que `localhost` en el celular de un estudiante. Antes de imprimir QRs reales, define la variable de entorno `VITE_APP_URL` del frontend con tu dominio real (ver ejemplo comentado en `docker-compose.yml`). Mientras no la definas, la pestaña QRs del panel te avisa con un aviso amarillo si detecta que estás en `localhost` o una IP de red local.
- **JWT_SECRET y contraseña de admin:** cambia ambos antes de exponer el proyecto fuera de tu red (ver sección "Cómo levantar el proyecto" abajo).
- **Login con límite de intentos:** `POST /api/admin/login` está protegido con un límite de 10 intentos cada 15 minutos por IP, para dificultar ataques de fuerza bruta contra la contraseña.

## Stack

- **Frontend:** Vue 3 + Vite + Vue Router + Pinia + Vue Flow (lienzo del grafo de mapeo)
- **Backend:** Node.js + Express + Prisma (ORM) + express-rate-limit (límite de intentos de login)
- **Base de datos:** PostgreSQL
- **Infraestructura:** Docker + Docker Compose

## Cómo levantar el proyecto

1. Clonar el repositorio.
2. Copiar el archivo de variables de entorno (ya viene creado en `backend/.env` con valores de desarrollo; en producción cambia `JWT_SECRET`).
3. Primera vez (construye las imágenes, tarda varios minutos):
   ```
   npm run dev:build
   ```
4. Las siguientes veces:
   ```
   npm run dev
   ```
5. Instalar dependencias nuevas dentro del contenedor (necesario tras traer este cambio, por Vue Flow en el frontend; en general, cada vez que se agregue una dependencia nueva):
   ```
   docker compose exec backend npm install
   docker compose exec frontend npm install
   ```
6. Crear/actualizar la base de datos (aplica la migración del grafo de mapeo si vienes de una versión anterior; el seed corre automáticamente tras la migración inicial):
   ```
   docker compose exec backend npx prisma migrate dev
   ```
7. Abrir:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000/health

## Datos de ejemplo cargados por el seed

- Admin: usuario `admin`, contraseña `cambiar-esta-clave` (cámbiala antes de producción).
- QR `entrada-principal` → Ruta hacia `Bloque C` → Espacios `C307` (piso 3) y `Cafetería Bloque C` (piso 1).

## Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta el proyecto (uso normal) |
| `npm run dev:build` | Levanta reconstruyendo (usar tras instalar dependencias nuevas o cambiar un Dockerfile) |
| `npm run dev:bg` | Levanta en segundo plano |
| `npm run stop` | Apaga todo |
| `npm run logs` | Ver logs en vivo (si se usó `dev:bg`) |
| `npm run reset-db` | ⚠️ Apaga y borra los datos de la base de datos |

## Base de datos y migraciones

1. Editar el modelo en `backend/prisma/schema.prisma`.
2. Generar la migración:
   ```
   docker compose exec backend npx prisma migrate dev --name nombre_descriptivo
   ```
3. Esto crea un archivo SQL en `backend/prisma/migrations/` que se sube a Git.
4. El resto del equipo, tras hacer `git pull`, solo corre:
   ```
   docker compose exec backend npx prisma migrate dev
   ```

## Estructura del proyecto

```
navigate-web/
├── backend/          # API en Node.js + Express + Prisma
│   ├── src/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── Dockerfile
├── frontend/         # Vue 3 + Vite
│   ├── src/
│   └── Dockerfile
├── docker-compose.yml
└── package.json      # Atajos de comandos (npm run dev, etc.)
```

## Próximos pasos (pendientes de implementar)

- [ ] Fase 2: plano visual del piso con zona resaltada por espacio (el grafo de mapeo ya cubre la generación automática de rutas, ver arriba).
