# Navi-Gate

Herramienta web para guiar a estudiantes dentro del campus universitario a través de códigos QR fijos: al escanear un QR ubicado en un punto físico, el usuario busca un espacio (salón, oficina, laboratorio, cafetería, baño, etc.) y recibe instrucciones de cómo llegar desde ese punto.

Incluye un panel de administración con login (JWT) para renombrar espacios sin afectar las rutas cargadas.

## Stack

- **Frontend:** Vue 3 + Vite + Vue Router + Pinia
- **Backend:** Node.js + Express + Prisma (ORM)
- **Base de datos:** PostgreSQL
- **Infraestructura:** Docker + Docker Compose

## Modelo de datos

- **Qr** — punto físico donde está pegado un código QR (identificado por `slug` único en la URL, ej. `/qr/entrada-principal`).
- **Bloque** — edificio o zona del campus. Agrupa uno o varios espacios.
- **Ruta** — instrucciones de texto para llegar desde un `Qr` (origen) hasta un `Bloque` (destino). Una sola ruta por combinación QR-Bloque.
- **Espacio** — salón, oficina, laboratorio, cafetería, baño, etc. (`enum TipoEspacio`), con `nombre` editable por el admin, `piso`, e `instruccionFinal` (detalle dentro del bloque). Renombrar un espacio nunca afecta la ruta ni la instrucción final.
- **Admin** — usuario del panel de administración. Se crea manualmente vía seed, sin registro público.

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
5. Instalar dependencias nuevas dentro del contenedor (solo la primera vez que agregues una dependencia, ej. bcrypt):
   ```
   docker compose exec backend npm install
   ```
6. Crear la migración inicial y cargar los datos de ejemplo (el seed corre automáticamente tras la migración):
   ```
   docker compose exec backend npx prisma migrate dev --name init_navigate
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

- [ ] Endpoint `POST /api/admin/login` (JWT) + middleware de autenticación.
- [ ] Endpoints públicos: `GET /api/qr/:slug`, `GET /api/espacios` (búsqueda + fuzzy search + filtro por piso), `GET /api/bloques`.
- [ ] Vista pública de búsqueda (`/qr/:slug`) con autocompletado y navegación por bloque.
- [ ] Vista de login y panel de administración protegido por JWT.
- [ ] Fase 2: plano visual del piso con zona resaltada por espacio.
- [ ] Fase 2: cálculo automático de rutas vía grafo de nodos, en vez de texto manual.
