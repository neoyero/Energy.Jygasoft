# Despliegue — energy-web

Co-hosteado con n8n en el droplet (DigitalOcean) + Cloudflare (Full Strict).
Stack: Docker Compose (postgres + migrate + web + Caddy).

## 1. Preparar entorno

```bash
cp .env.production.example .env
# Edita .env: POSTGRES_PASSWORD, DATABASE_URL, secretos n8n/Meta/Turnstile, AUTH_SECRET.
# AUTH_SECRET: openssl rand -base64 32
```

## 2. Levantar

```bash
docker compose up -d --build
# Orden: db (healthy) → migrate (aplica db/migrations/0000_init.sql) → web → caddy
```

## 3. Sembrar datos base (solo primer deploy)

```bash
docker compose run --rm migrate pnpm db:seed          # config_parametros, tarifas_cfe, hsp_zonas, catálogo, usuarios
docker compose run --rm migrate pnpm db:set-password <email-admin> '<password>'
```

> Los seeds usan INSERT no idempotente: ejecútalos UNA sola vez.

## 4. Cloudflare

- Registro **A** `energy` → IP del droplet, **proxied**.
- SSL/TLS: **Full (Strict)**. Caddy emite cert Let's Encrypt (público y válido) → CF lo confía.
- Regla de caché para `/_next/static/*` (Caddy ya manda `Cache-Control immutable`).

## 5. Verificación

```bash
curl -fsS https://energy.jygasoft.com/api/health   # {"status":"ok","db":true}
```

- `/` y marketing sirven; `/admin` redirige a `/admin/login`.
- Un lead de prueba debe aparecer en `leads` + `form_submissions` y llegar firmado a n8n.

## Migraciones posteriores

```bash
pnpm db:generate    # genera nueva migración desde cambios en db/schema.ts
docker compose run --rm migrate pnpm db:migrate
```

## Códigos postales (SEPOMEX nacional)

El autocompletado CP → estado + municipio de la calculadora se sirve desde la tabla
`codigos_postales` (Catálogo Nacional de Correos de México). Para cargarla/actualizarla
desde los `.xls`/`.xlsx` de SEPOMEX (un archivo por estado, hoja del estado + hoja `Nota`):

```powershell
# Windows + Excel instalado. Convierte los .xls a CSV y recarga la tabla (TRUNCATE + carga).
powershell -ExecutionPolicy Bypass -File db/scripts/import-cp.ps1 -StateDir "C:\State"
```

- El script ignora la hoja `Nota`, exporta la hoja del estado a CSV UTF-8 y llama al loader.
- El loader (`pnpm db:import-cp <dir-csv>`) asegura el esquema (migración `0001`), siembra
  `hsp_estados` (HSP por estado, fallback de la calculadora) y recarga la tabla completa.
- Es idempotente: re-ejecutar sustituye todo el catálogo. Para incluir Aguascalientes,
  coloca `Aguascalientes.xls` en la carpeta; mientras tanto el endpoint usa el mapa local
  `lib/data/cp-municipios.json` como fallback para AGS.
- Resolución de HSP en la calculadora: `hsp_zonas` (municipio) → `hsp_estados` (estado) → 5.9.

## Notas

- El droplet ya corre ~55–60% CPU: los servicios tienen `mem_limit` + swap. Si satura,
  migrar es trivial (todo contenerizado; solo cambia `DATABASE_URL`).
- Imagen `web` = Next standalone (Node 20, no-root). Healthcheck en `/api/health`.
