# Guía de despliegue de Navi-Gate (gratis)

Esta guía te lleva de "funciona en mi PC" a "funciona en internet y mis amigos pueden editarlo", sin gastar dinero y sin dejar tu PC prendido.

## Qué vas a montar

```
Celular / navegador
      │
      ▼
 Vercel  (frontend Vue)  ──────►  Render  (backend Node/Express)
                                      │            │
                                      ▼            ▼
                                    Neon       Cloudinary
                              (PostgreSQL)      (fotos)
```

| Pieza | Plataforma | Límites del plan gratis que te afectan |
|---|---|---|
| Frontend | **Vercel** | Plan Hobby: es para uso personal/no comercial. Para un proyecto universitario está bien. |
| Backend | **Render** (Web Service, plan Free) | Se duerme tras 15 min sin visitas; despertar tarda cerca de 1 minuto. Disco efímero. Sin terminal. 750 horas gratis al mes. |
| Base de datos | **Neon** | Gratis permanente. Se "duerme" tras unos minutos sin uso; la primera consulta tarda un poco más. |
| Fotos | **Cloudinary** | Gratis con cuota mensual. Reemplaza al disco local, que en Render se borra solo. |

> Render aclara que su plan gratuito es para pruebas y proyectos personales, no para producción seria. Para este proyecto está bien. Si algún día se vuelve crítico, lo primero que habría que pagar es el backend.

**Tiempo estimado:** 60 a 90 minutos la primera vez.
**Seguir el orden importa:** varios pasos usan datos que sacas en pasos anteriores.

> Los nombres de botones y pantallas son los vigentes al escribir esto. Si alguna plataforma cambió su diseño, busca el equivalente más parecido.

---

## Antes de empezar

Necesitas:

- [ ] Docker Desktop abierto y tu proyecto andando (`docker compose up`).
- [ ] Git instalado (`git --version` debe responder).
- [ ] Una cuenta de **GitHub** (github.com).
- [ ] Un correo para crear cuentas en **Neon**, **Cloudinary**, **Render** y **Vercel**. En Render y Vercel lo más cómodo es entrar con "Continue with GitHub".

Los comandos de esta guía funcionan en PowerShell, CMD, Git Bash y WSL. Las URLs se escriben **entre comillas dobles**, porque llevan caracteres como `&` y `?`.

### Hoja de datos (ve llenándola)

Copia esto en un bloc de notas. Cada paso te dice cuándo llenar una línea. **Es información secreta: no la subas a GitHub ni la compartas.**

```
DATABASE_URL    (Neon, con pooler)  = 
DIRECT_URL      (Neon, sin pooler)  = 
CLOUDINARY_URL                      = 
JWT_SECRET                          = 
URL_RENDER      (backend)           = 
URL_VERCEL      (frontend)          = 
```

---

## Paso 0 — Preparar el proyecto y subirlo a GitHub

### 0.1 Aplicar la última versión

Descomprime el `Navi-Gate.zip` más reciente encima de la carpeta de tu proyecto (sobrescribe los archivos; no toca tu `.git` ni tu `backend/.env`). Luego instala la dependencia nueva del backend y reinicia:

```bash
docker compose exec backend npm install
docker compose restart backend frontend
```

Comprueba que en local todo sigue funcionando: entra al panel admin y sube una foto de prueba. En local las fotos siguen yendo a `backend/uploads`, como siempre.

### 0.2 Verificar que no vas a subir secretos

En la carpeta del proyecto:

```bash
git ls-files backend/.env
```

**No debe imprimir nada.** Si imprime `backend/.env`, detente: ese archivo está siendo rastreado por git y tendrías que sacarlo antes de subirlo (`git rm --cached backend/.env`).

### 0.3 Crear el repositorio en GitHub

1. Entra a github.com/new.
2. **Repository name:** `navi-gate`.
3. Elige **Private**.
4. **No** marques "Add a README", ni `.gitignore`, ni licencia (el repo debe quedar vacío).
5. Clic en **Create repository**. Copia la URL que termina en `.git`.

### 0.4 Subir el código

```bash
git status
git branch --show-current
git remote -v
```

- `git branch --show-current` te dice el nombre de tu rama (casi seguro `main`; si dice `master`, usa ese nombre más abajo).
- Si `git remote -v` ya muestra un `origin`, no hace falta agregarlo.

```bash
git add .
git commit -m "Preparar despliegue"
git remote add origin https://github.com/TU-USUARIO/navi-gate.git
git push -u origin main
```

(Omite `git remote add` si `origin` ya existía.)

✅ **Debes ver** el código en `github.com/TU-USUARIO/navi-gate`, y que `backend/.env` **no** aparece en la lista de archivos.

---

## Paso 1 — Neon (base de datos)

1. Entra a **neon.com** y crea una cuenta.
2. **Create project**:
   - **Name:** `navi-gate`
   - **Region:** **AWS US East (N. Virginia)**. Queda cerca de Render (Virginia), lo que reduce la latencia entre backend y base de datos.
   - El resto, por defecto.
3. En el **Project Dashboard**, clic en el botón **Connect**. Se abre *Connect to your database*.
4. Deja la rama (`main`), la base de datos y el rol que vienen por defecto.
5. **Con el interruptor "Connection pooling" activado**, copia la cadena de conexión (el host contiene `-pooler`). Pégala en tu hoja como **`DATABASE_URL`**.
6. **Desactiva "Connection pooling"**. El host ya no tiene `-pooler`. Copia esa cadena y pégala como **`DIRECT_URL`**.
7. Si alguna cadena termina en `&channel_binding=require`, bórrale esa parte. Deben terminar en `?sslmode=require`.

Se ven así:

```
postgresql://USUARIO:CLAVE@ep-algo-123456-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require   ← DATABASE_URL
postgresql://USUARIO:CLAVE@ep-algo-123456.us-east-1.aws.neon.tech/neondb?sslmode=require          ← DIRECT_URL
```

**Por qué dos:** la app usa la cadena con pooler (más eficiente con muchas conexiones). Las migraciones necesitan la directa, porque el pooler no se lleva bien con ellas.

---

## Paso 2 — Llevar tus datos de local a Neon

Copia **todo** lo que ya cargaste: QRs, bloques, espacios, rutas, grafo, eventos y cuentas de admin.

> ⚠️ Hazlo **antes** del primer despliegue en Render. La base de Neon tiene que estar vacía; si Render ya creó las tablas, la restauración chocará.

> *¿Prefieres empezar de cero?* Sáltate este paso. Render creará las tablas vacías y tú crearás las cuentas en el Paso 8.

Con Docker corriendo, un solo comando (pega tu **`DIRECT_URL`** entre las comillas simples):

```bash
docker compose exec db sh -c "pg_dump -U postgres -d navigate --no-owner --no-acl | psql -v ON_ERROR_STOP=1 'PEGA-AQUI-TU-DIRECT_URL'"
```

Todo ocurre dentro del contenedor de la base de datos, así que no depende de PowerShell ni crea archivos intermedios.

✅ **Debes ver** una lista larga de líneas como `SET`, `CREATE TABLE`, `COPY 12`, `ALTER TABLE`, sin ningún `ERROR`.

Verifica:

```bash
docker compose exec db sh -c "psql 'PEGA-AQUI-TU-DIRECT_URL' -c 'SELECT count(*) FROM espacios;' -c 'SELECT count(*) FROM _prisma_migrations;'"
```

El primer número debe ser la cantidad de espacios que tienes. El segundo debe ser **8** (las migraciones del proyecto). Eso le dice a Render que no hay migraciones pendientes.

**Si falla:**
- `could not translate host name` / `connection refused`: revisa que pegaste la `DIRECT_URL` completa y entre comillas.
- `already exists`: la base de Neon no estaba vacía. Elimina el proyecto en Neon y crea uno nuevo (Paso 1), y repite.

---

## Paso 3 — Cloudinary (fotos)

1. Entra a **cloudinary.com** y crea una cuenta gratuita.
2. En la consola, abre **Settings** (el ícono de engranaje en la barra lateral izquierda) → **API Keys**.
3. Verás tu **Cloud name**, tu **API Key** y tu **API Secret**. Para ver el secret puede pedirte tu contraseña.
4. Busca **API environment variable**. Muestra un formato así, **con marcadores que debes reemplazar**:

```
cloudinary://<your_api_key>:<your_api_secret>@tu_cloud_name
```

5. Reemplaza `<your_api_key>` y `<your_api_secret>` por los valores reales, **sin los símbolos `<` `>`**. Queda así:

```
cloudinary://123456789012345:AbCdEfGhIjKlMnOpQrStUvWxYz@tu_cloud_name
```

Pégala en tu hoja como **`CLOUDINARY_URL`**.

---

## Paso 4 — Pasar a Cloudinary las fotos que ya subiste en local

Solo si ya habías subido fotos (a rutas, espacios o eventos). En la base que copiaste, esas fotos apuntan a `http://localhost:3000/...`, que no existe en internet. Este script las sube a Cloudinary y corrige las URLs en la base:

```bash
docker compose exec -e DATABASE_URL="PEGA-TU-DATABASE_URL" -e CLOUDINARY_URL="PEGA-TU-CLOUDINARY_URL" backend node scripts/migrar-fotos.js
```

✅ **Debes ver** algo como:

```
Subiendo 3 foto(s) a Cloudinary…
  ✓ 1787772227761-30949a5eaefa.jpg
  ✓ ...
Listo: 3 foto(s) subidas, 4 registro(s) actualizados.
```

Si no tenías fotos, dirá `No hay fotos locales que migrar.` Es seguro repetirlo.

---

## Paso 5 — Render (backend)

### 5.1 Crear el servicio

1. Entra a **render.com** y crea una cuenta (lo más cómodo: **Continue with GitHub**).
2. Clic en **New +** → **Web Service**.
3. En *Source Code*, elige tu repositorio `navi-gate`. Si no aparece, usa **Configure account** para darle a Render acceso a ese repo.
4. Completa:

| Campo | Valor |
|---|---|
| **Name** | `navi-gate-api` |
| **Language / Runtime** | `Node` |
| **Branch** | `main` |
| **Region** | **Virginia (US East)** |
| **Root Directory** | `backend` |
| **Build Command** | `npm install && npx prisma generate && npx prisma migrate deploy` |
| **Start Command** | `npm start` |
| **Instance Type** | **Free** |

> Las migraciones van en el **Build Command**, no en el Start Command. Así, cada vez que el servicio despierte de su sueño, arranca directo sin gastar tiempo migrando.

### 5.2 Variables de entorno

En la sección **Environment Variables**, agrega estas (botón **Add Environment Variable**):

| Key | Value |
|---|---|
| `NODE_VERSION` | `22` |
| `DATABASE_URL` | tu cadena **con pooler** de Neon |
| `DIRECT_URL` | tu cadena **directa** de Neon |
| `JWT_SECRET` | una clave larga y aleatoria (ver abajo) |
| `CLOUDINARY_URL` | la de Cloudinary, ya con tus valores reales |

**No agregues `FRONTEND_URL` todavía** (se hace en el Paso 7).

Para generar el `JWT_SECRET` (no necesitas tener Node en tu PC; lo hace el contenedor):

```bash
docker compose exec backend node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copia la cadena larga que imprime y pégala en la hoja como `JWT_SECRET` y en Render.

### 5.3 Health check

Abre **Advanced** y en **Health Check Path** escribe `/health`.

### 5.4 Desplegar

Clic en **Create Web Service**. Se abre el log del despliegue; tarda varios minutos la primera vez.

✅ **Debes ver** en el log, en orden aproximado:

```
Prisma schema loaded from prisma/schema.prisma
8 migrations found in prisma/migrations
No pending migrations to apply.        (o "The following migration(s) have been applied")
...
Backend corriendo en el puerto 10000
Your service is live 🎉
```

Arriba a la izquierda de la pantalla del servicio verás su URL, parecida a `https://navi-gate-api.onrender.com`. **Cópiala tal cual** a tu hoja como `URL_RENDER` (si el nombre estaba ocupado, Render le agrega letras).

### 5.5 Probarlo

Abre en el navegador `URL_RENDER/health`. ✅ Debe responder:

```json
{"status":"ok","mensaje":"Backend funcionando correctamente"}
```

Si es la primera vez en un rato, puede tardar cerca de un minuto en responder (el servicio está despertando).

**Si el build falla:**
- `P1001: Can't reach database server`: la `DIRECT_URL` está mal copiada, o le quitaste algo de más.
- `P3009` / "failed migrations": restauraste la base *después* de que Render creó tablas. Ver la tabla de problemas al final.
- `Cannot find module ...`: confirma que **Root Directory** es `backend`.

---

## Paso 6 — Vercel (frontend)

1. Entra a **vercel.com** y crea una cuenta (**Continue with GitHub**).
2. **Add New…** → **Project** → en *Import Git Repository*, clic en **Import** junto a `navi-gate`.
3. En **Configure Project**:
   - **Project Name:** elige un nombre. Define la dirección, que será `https://ESE-NOMBRE.vercel.app`. Algo como `navi-gate-tuapellido`.
   - **Framework Preset:** `Vite` (se detecta solo).
   - **Root Directory:** clic en **Edit**, elige la carpeta `frontend` y confirma. **Este paso es crítico.**
4. Abre **Environment Variables** y agrega:

| Name | Value |
|---|---|
| `VITE_API_URL` | tu `URL_RENDER`, **sin `/` al final** (ej. `https://navi-gate-api.onrender.com`) |
| `VITE_APP_URL` | `https://ESE-NOMBRE.vercel.app` (el nombre de proyecto que elegiste, **sin `/` al final**) |

5. Clic en **Deploy** (≈1 minuto).

✅ Al terminar, Vercel muestra la pantalla de felicitación con la dirección de tu sitio. **Compárala con lo que pusiste en `VITE_APP_URL`**:
- Si coincide, perfecto. Cópiala a tu hoja como `URL_VERCEL`.
- Si Vercel te asignó otra distinta, ve a **Settings → Environment Variables**, corrige `VITE_APP_URL` y haz **Deployments → ⋯ → Redeploy**.

> Las variables `VITE_*` se "hornean" al compilar: si las cambias, **siempre hay que hacer Redeploy** para que tomen efecto.

**Si el build falla** por la versión de Node (el frontend pide Node 22.18+ o 24.12+): **Settings → Build and Deployment → Node.js Version** → elige `22.x` o `24.x` y vuelve a desplegar.

---

## Paso 7 — Autorizar al frontend en el backend (CORS)

El backend solo acepta llamadas del sitio que tú le indiques.

1. En Render, entra a tu servicio → **Environment**.
2. Agrega `FRONTEND_URL` = tu `URL_VERCEL` (con `https://`, **sin `/` al final**).
3. Guarda. Render redespliega solo (1-3 minutos).

Si algún día tienes más de un dominio (por ejemplo, uno propio), sepáralos con coma: `https://a.com,https://b.com`.

---

## Paso 8 — Cuentas de admin

Render gratis no tiene terminal, así que las cuentas se crean **desde tu PC**, apuntando a la base de Neon. Usa tu **`DATABASE_URL`** (la de pooler):

```bash
docker compose exec -e DATABASE_URL="PEGA-TU-DATABASE_URL" backend node scripts/cambiar-password.js admin "UNA-CLAVE-SEGURA"
```

Repite para cada amigo, con su propio usuario:

```bash
docker compose exec -e DATABASE_URL="PEGA-TU-DATABASE_URL" backend node scripts/cambiar-password.js amigo1 "OTRA-CLAVE-SEGURA"
```

✅ Debe responder `Contraseña actualizada para "admin".`

- Si copiaste tu base en el Paso 2, `admin` ya existe con tu clave de desarrollo: **cámbiala ahora** con el primer comando.
- Si el usuario no existe, lo crea.
- Mínimo 8 caracteres.
- Una cuenta por persona: así puedes quitarle acceso a uno sin cambiarles la clave a todos.

---

## Paso 9 — Probarlo todo

Abre tu `URL_VERCEL` y revisa, en este orden:

- [ ] `URL_VERCEL/admin/login` abre y te deja entrar con tu cuenta. *(La primera vez puede tardar hasta ~1 minuto: es el backend despertando.)*
- [ ] Pestaña **QRs**: los códigos usan tu dirección de Vercel y **no** aparece el aviso amarillo de `localhost`.
- [ ] Pestaña **Rutas** o **Espacios**: tus datos de local están ahí.
- [ ] Sube una foto nueva. Después de guardar, la imagen carga, y su dirección empieza con `https://res.cloudinary.com/`.
- [ ] Pestaña **Eventos**: crea un evento que esté en curso ahora, con un sub-evento en un espacio que tenga ruta desde algún QR.
- [ ] **Con tu celular**, escanea el QR (o abre `URL_VERCEL/qr/EL-SLUG`). En Inicio debe aparecer la burbuja de eventos.
- [ ] Pestaña **Estadísticas**: el escaneo quedó contado.

---

## Paso 10 — Imprimir los QRs

Descarga los QRs **desde el panel de producción** (pestaña QRs de `URL_VERCEL/admin`). Los que bajaste antes en local apuntan a `localhost` y no sirven impresos.

> Un QR impreso queda pegado para siempre a la dirección con la que se generó. Si quieres un **dominio propio** (por ejemplo `navigate.tu-universidad.edu`), configúralo en Vercel (Settings → Domains), actualiza `VITE_APP_URL` y `FRONTEND_URL` y haz Redeploy **antes de imprimir**.

---

## Después del despliegue

| Quieres… | Haz… |
|---|---|
| Cambiar código | `git add .` → `git commit -m "..."` → `git push`. Render y Vercel redespliegan solos (1-3 min). |
| Cambiar tablas o campos | En local: `docker compose exec backend npx prisma migrate dev --name lo_que_sea`. Commit y push. El Build Command de Render aplica la migración en producción. |
| Editar datos (espacios, rutas, grafo, eventos) | Desde el panel. Se ve al instante, sin redesplegar. |
| Dar acceso a un amigo | Paso 8, con un usuario nuevo. |
| Cambiar una clave | Paso 8 con el mismo usuario. |
| Ver errores del backend | Render → tu servicio → **Logs**. |

## Opcional: evitar la espera de ~1 minuto

Sin hacer nada, la primera persona que escanee tras 15 minutos de inactividad espera cerca de un minuto (la app le muestra un aviso explicándolo). Para evitarlo, un servicio gratuito como **UptimeRobot** puede visitar `URL_RENDER/health` cada 5 minutos y mantener el backend despierto.

Lo que debes saber antes de hacerlo: Render da 750 horas gratis al mes por cuenta y un solo servicio encendido todo el mes consume unas 744, así que alcanza. Pero esas horas se gastan aunque nadie use la app, y es tu único servicio gratuito.

---

## Si algo falla

| Síntoma | Causa probable y solución |
|---|---|
| El panel muestra "Failed to fetch" o error de CORS | `FRONTEND_URL` en Render está mal: sin `https://`, con `/` al final, o es distinta a tu dirección real de Vercel. Corrígela. |
| La app intenta llamar a `localhost:3000` | `VITE_API_URL` no estaba definida al compilar. Defínela en Vercel y haz **Redeploy**. |
| Todo carga pero los QRs dicen `localhost` | Falta `VITE_APP_URL` en Vercel (o falta el Redeploy después de ponerla). |
| Render: build falla con `P1001` | `DIRECT_URL` mal copiada, o pegaste en ella la cadena con pooler. |
| Render: `P3009` / "failed migrations" | Restauraste en Neon *después* de que Render ya había creado tablas. Crea un proyecto nuevo en Neon, repite el Paso 2 **antes** de redesplegar y actualiza `DATABASE_URL` y `DIRECT_URL` en Render. |
| Recargar `/app/inicio` da 404 | Vercel no está usando `frontend` como Root Directory (ahí vive `vercel.json`). Corrígelo en Settings → General y haz Redeploy. |
| Vercel: build falla por la versión de Node | Settings → Build and Deployment → Node.js Version → `22.x`. |
| Subir una foto da error | `CLOUDINARY_URL` mal copiada en Render (revisa que reemplazaste `<your_api_key>` y `<your_api_secret>` sin dejar los `<>`). |
| Las fotos de antes salen rotas | No corriste el Paso 4, o falló. Repítelo. |
| "Demasiados intentos" al iniciar sesión | Límite de 10 intentos cada 15 minutos por IP. Espera. |
| La primera carga tarda ~1 minuto | Arranque en frío de Render. Es normal en el plan gratis. |
| Cualquier otro error del backend | Render → **Logs**. Ahí aparece el mensaje exacto. |
