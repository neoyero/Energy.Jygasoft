# Plan de construcción del sitio — Jygasoft Energy (spec para Claude Code)

> **v2.0 · 2026-06-19.** Documento ejecutable: dáselo a Claude Code para construir el sitio paso a paso.
> **Meta:** sitio corporativo + motor de captación + **mini-CRM** para gestionar todo el ciclo (ventas → entrega → finanzas → postventa), **robusto pero ligero y rápido**. El sitio captura y dispara; **la orquestación vive en n8n**; los datos en **PostgreSQL**. Esquema de BD: `Esquema_BD_Postgres.sql` (v2, 23 tablas, verificado).

---

## 0. Decisiones fijadas (no re-litigar)
- **Framework:** Next.js 15 (App Router) + TypeScript, Node 20 LTS, **pnpm**.
- **UI:** Tailwind CSS + **shadcn/ui** (Radix). Íconos: lucide-react.
- **ORM/DB:** **Drizzle ORM** + `drizzle-kit` sobre **PostgreSQL 15** (driver `pg`/`postgres`).
- **Contenido/blog v1:** **MDX local** (colección tipada con **Velite**). *WordPress headless se integra después vía un adaptador (ver §12); no es dependencia de v1.*
- **Formularios:** react-hook-form + **Zod**; envío a **Route Handler** server-side que **firma HMAC** y reenvía a **n8n**.
- **CRM:** **mini-CRM propio** (23 tablas: ventas, entrega, finanzas, marketing, actividades, documentos) + **panel a medida** en el mismo Next.js (Auth.js).
- **Auth (panel):** Auth.js (NextAuth v5), estrategia **JWT**, provider **credentials** contra `usuarios` (hash con argon2).
- **Infra:** DigitalOcean + **Cloudflare** (proxied, Full Strict). Dominio **energy.jygasoft.com**. Postgres puede vivir en el Droplet de n8n (`10.124.0.3`, misma VPC) — **se conecta por `DATABASE_URL`** (placement final pendiente; el contenedor corre igual co-hosteado o en Droplet dedicado).
- **Analítica:** Meta **Pixel** (cliente) + **Conversions API** server-side con **deduplicación por `event_id`**; GA4 opcional.
- **Idioma:** es-MX (un solo locale; sin routing i18n).

---

## 1. Estructura del repositorio
```
energy-web/
├─ app/
│  ├─ (marketing)/            # rutas públicas (SSG/ISR)
│  │  ├─ page.tsx             # Home
│  │  ├─ casa/page.tsx        # Residencial
│  │  ├─ negocio/page.tsx     # Comercial/Industrial
│  │  ├─ calculadora/page.tsx # Lead magnet
│  │  ├─ como-funciona/page.tsx
│  │  ├─ casos/page.tsx
│  │  ├─ blog/[slug]/page.tsx
│  │  ├─ faq/page.tsx
│  │  ├─ nosotros/page.tsx
│  │  ├─ contacto/page.tsx
│  │  └─ legal/(aviso-privacidad|terminos)/page.tsx
│  ├─ (admin)/                # mini-CRM (auth, no-index)
│  │  ├─ layout.tsx           # guard por rol
│  │  ├─ leads/  clientes/  contactos/  oportunidades/   (pipeline)
│  │  ├─ cotizaciones/  proyectos/  tramites-cfe/  instalaciones/
│  │  ├─ materiales/  pagos/  catalogo/  campanas/
│  │  └─ actividades/  documentos/  metricas/
│  ├─ api/
│  │  ├─ lead/route.ts        # POST formularios → n8n (HMAC)
│  │  ├─ calculadora/route.ts # POST cálculo + guarda simulación
│  │  ├─ webhooks/n8n/route.ts# inbound desde n8n (verifica HMAC) → actualiza lead/proyecto
│  │  ├─ health/route.ts
│  │  └─ auth/[...nextauth]/route.ts
│  ├─ sitemap.ts  robots.ts  opengraph-image.tsx
│  └─ layout.tsx  globals.css
├─ components/  (ui/, forms/, sections/, admin/)
├─ content/     (blog/*.mdx, casos/*.mdx, faq.mdx)  # MDX local
├─ db/
│  ├─ schema.ts               # Drizzle (espejo de Esquema_BD_Postgres.sql)
│  ├─ index.ts                # pool + drizzle()
│  └─ migrations/0000_init.sql# = Esquema_BD_Postgres.sql
├─ lib/  (hmac.ts, calc.ts, leadScore.ts, meta-capi.ts, rate-limit.ts, validators/*.ts, env.ts)
├─ middleware.ts              # security headers + guard /admin
├─ Dockerfile  docker-compose.yml  Caddyfile
├─ drizzle.config.ts  next.config.ts  velite.config.ts
└─ .env.example
```

---

## 2. Variables de entorno (`.env.example`)
```
# DB
DATABASE_URL=postgres://energy_app:***@10.124.0.3:5432/energy_app
# n8n
N8N_WEBHOOK_URL=https://n8n.jygasoft.com/webhook/energy-lead
N8N_HMAC_SECRET=***            # llave compartida (server-only)
N8N_HMAC_KID=energy-web-v1
WEBHOOK_INBOUND_SECRET=***     # para verificar inbound de n8n
# Auth
AUTH_SECRET=***
AUTH_URL=https://energy.jygasoft.com
# Meta
META_PIXEL_ID=***
META_CAPI_TOKEN=***            # server-only
NEXT_PUBLIC_META_PIXEL_ID=***  # cliente
# Anti-spam
NEXT_PUBLIC_TURNSTILE_SITE_KEY=***
TURNSTILE_SECRET=***
# App
NEXT_PUBLIC_SITE_URL=https://energy.jygasoft.com
NODE_ENV=production
```
> Regla: **solo** las `NEXT_PUBLIC_*` llegan al navegador. HMAC/CAPI/DB **nunca** en el cliente.

---

## 3. Base de datos — mini-CRM (capa de datos)
- Fuente canónica: **`Esquema_BD_Postgres.sql`** (**25 tablas** — verificado) + **`Seeds_Datos.sql`** (datos reales: tarifas CFE jun-2026, HSP de Aguascalientes, catálogo y constantes calibradas con el estudio de mercado). Aplica el esquema como `0000_init.sql` y luego carga los seeds.
- Define **`db/schema.ts`** en Drizzle reflejando ese SQL (enums con `pgEnum`, FKs, defaults, columnas generadas como `cotizacion_items.importe`). Cambios posteriores con `drizzle-kit generate`.
- **Módulos / tablas:**
  - *Ventas:* `leads` → `clientes` (PF/PM) + `contactos` → `oportunidades` (deals: etapa, monto, probabilidad, forecast) → `cotizaciones` + `cotizacion_items`.
  - *Entrega:* `proyectos` (fases 00–06) con `tramites_cfe` (estatus+fechas del trámite), `instalaciones` (cuadrilla/avance) y `proyecto_materiales` (BOM).
  - *Finanzas:* `pagos` (calendario, CFDI, estado).
  - *Marketing:* `campanas` (plataforma/zona/presupuesto/UTM/métricas), ligadas vía `leads.campana_id`.
  - *Catálogo:* `catalogo_equipos` (paneles/inversores/…), `hsp_zonas`.
  - *Transversal:* `actividades` (tareas/llamadas/visitas asignables con vencimiento), `eventos` (**timeline unificado** polimórfico por `entidad_tipo`/`entidad_id`), `documentos` (archivos por entidad/fase), `usuarios` + `cuadrillas`/`cuadrilla_miembros`.
  - *Integración:* `form_submissions` (auditoría + **idempotencia** vía `request_id`), `webhook_log`, `calculadora_simulaciones`.
  - *Parametrización (flexible):* `config_parametros` (constantes de la calculadora) y `tarifas_cfe` ($/kWh por tarifa con **vigencia** e histórico); **editables desde `/admin`, sin tocar código**.
- **Pool**: `pg.Pool` (max 5–10); co-hosteado en el Droplet, pool directo.
- **Robustez:** UUID en entidades, `bigint identity` en tablas de alto volumen (`eventos`, `actividades`, `*_items`, `*_materiales`); FKs con `ON DELETE` apropiado; `updated_at` por trigger; índices en FKs/estados/fechas/búsqueda y **GIN** en `utm`.
- **Trazabilidad:** todo cambio relevante inserta en `eventos`; tareas y seguimientos en `actividades`. **Idempotencia** evita leads duplicados si n8n reintenta.

---

## 4. Contrato de datos y firma (sitio ↔ n8n)
**Saliente (form → n8n).** `POST {N8N_WEBHOOK_URL}` con cabeceras:
- `X-Jygasoft-Signature: sha256=<hex>` — HMAC-SHA256 de `timestamp + "." + rawBody`.
- `X-Jygasoft-Timestamp`, `X-Jygasoft-Request-Id` (uuid), `X-Jygasoft-Kid` (= `N8N_HMAC_KID`).
- Body JSON:
```json
{ "schema_version":1, "evento":"lead.created", "request_id":"<uuid>",
  "lead": { "nombre","email","telefono","segmento","uso","cp","municipio",
            "consumo_kwh_mes","recibo_mxn","es_titular","es_propietario",
            "consentimiento_datos","consentimiento_marketing" },
  "origen": { "form","landing_url","referrer","utm": {...} },
  "sizing": { "kwp","paneles","inversion_min","inversion_max","ahorro_estimado_mxn" } }
```
**`lib/hmac.ts`** (referencia):
```ts
import { createHmac, timingSafeEqual } from "crypto";
export function sign(body: string, ts: string, secret: string) {
  return "sha256=" + createHmac("sha256", secret).update(ts + "." + body).digest("hex");
}
export function verify(body: string, ts: string, sig: string, secret: string) {
  const expected = sign(body, ts, secret);
  const a = Buffer.from(expected), b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b)
    && Math.abs(Date.now() - Number(ts)) < 5 * 60_000; // ventana 5 min anti-replay
}
```
**Entrante (n8n → sitio).** `POST /api/webhooks/n8n` verifica la misma firma con `WEBHOOK_INBOUND_SECRET` y actualiza `leads.estado`/`vendedor_id`, `oportunidades.etapa`, `proyectos.fase` o `tramites_cfe.estado`, registrando en `webhook_log` + `eventos`.

> El sitio escribe el lead en Postgres **y** dispara a n8n. Si n8n cae, el lead ya quedó persistido (cola/reintento desde `form_submissions`).

---

## 5. Formularios
Formularios (todos: validación Zod en cliente y servidor, Turnstile, honeypot, rate-limit por IP):
| Form | Ruta | Campos | Evento |
|---|---|---|---|
| Lead rápido | home/landings | nombre, WhatsApp, casa/negocio, CP | `lead.created` |
| Calculadora | /calculadora | recibo o consumo, CP, segmento | `lead.created` + simulación |
| Contacto | /contacto | + mensaje, horario | `lead.created` |
| Cotización | /casa, /negocio | consumo, techo, fotos | `lead.created` |

Flujo del Route Handler `/api/lead`: validar → `INSERT form_submissions` (con `request_id`) → `INSERT/UPSERT leads` (dedupe por email/teléfono) → `INSERT eventos(entidad_tipo='lead', tipo='creado')` → firmar y `POST` a n8n → registrar `webhook_log` → responder 200. Disparar **Meta CAPI** con `event_id = request_id` (mismo id que el Pixel del cliente, para deduplicar).

---

## 6. Calculadora de ahorro (lib/calc.ts)
Entradas: `recibo_mxn` **o** `consumo_kwh_mes`, `cp`/`municipio`, `segmento`/`tarifa`. **Constantes y tarifas viven en BD** (`config_parametros`, `tarifas_cfe`), no en código — ya calibradas: `PR=0.77`, `WP_PANEL=600`, `COSTO_KWP_MIN=14000`, `COSTO_KWP_MAX=17500` MXN/kWp (≈$0.80–1.00 USD/W, estudio de mercado), `USD_MXN=17.5`.
```
PRECIO_KWH = tarifas_cfe[tarifa del lead], usando el rate MARGINAL que el solar desplaza:
             Tarifa 1 -> 4.004 (excedente) · DAC -> 6.752 · PDBT -> 3.771   (CFE jun-2026)
consumo_kwh_mes = recibo_mxn / PRECIO_KWH   (si solo dan el recibo)
HSP            = hsp_zonas[municipio].hsp ?? 5.9
kwp            = (consumo_kwh_mes/30) / (HSP * PR)
paneles        = ceil(kwp*1000 / WP_PANEL)
prod_anual_kwh = kwp * HSP * 365 * PR
inversion      = [kwp*COSTO_KWP_MIN, kwp*COSTO_KWP_MAX]
ahorro_anual   = min(prod_anual_kwh, consumo_kwh_mes*12) * PRECIO_KWH
payback_anios  = inversion_prom / ahorro_anual
```
Guardar en `calculadora_simulaciones`; si deja contacto, crear/asociar `leads` y disparar `lead.created`. **Mostrar disclaimer**: estimación referencial; excedentes se liquidan a **PML** (menor a tarifa), sujeto a consumo/tarifa/esquema. Cálculo en **servidor** (no exponer constantes de costo).

## 7. Scoring de lead (lib/leadScore.ts)
Suma puntos: tipo definido (+), CP/HSP (+), consumo/recibo (+, más si hay foto), titularidad (+), rango no rechazado (+), intención de agenda (+). `>= umbral` ⇒ marca señal "caliente" (n8n decide enrutamiento final). El sitio sólo calcula y envía; **no asigna vendedor** (lo hace n8n).

---

## 8. Mini-CRM (/admin)
- **Auth.js** credentials contra `usuarios` (argon2); middleware `/admin/*` con sesión y permisos por `rol` (admin, gerente, vendedor, ingeniería, líder/cuadrilla, finanzas, marketing, lectura). Todo `/admin` con `noindex`.
- **Módulos:**
  - **Leads** — kanban por `estado`, filtros canal/zona/vendedor/campaña; detalle con timeline (`eventos`) y `actividades`; **convertir** a cliente + oportunidad.
  - **Clientes / Contactos** — fichas PF/PM con datos fiscales (RFC/CSF), servicio CFE (RMU) y titularidad.
  - **Pipeline (Oportunidades)** — board por `etapa`, monto/probabilidad/forecast, motivo de pérdida.
  - **Cotizaciones** — versionadas con `cotizacion_items` (importe calculado); estado; PDF.
  - **Proyectos** — board por `fase` (00–06); ficha con ruta de carpeta, **Trámite CFE** (estatus + fechas), **Instalaciones** (cuadrilla/avance) y **Materiales** (BOM).
  - **Finanzas (Pagos)** — calendario programado vs pagado, CFDI, vencidos.
  - **Catálogo** (equipos + HSP) · **Campañas** (presupuesto/métricas y leads atribuidos).
  - **Actividades** — agenda de tareas/seguimientos por usuario (vencimientos; recordatorios vía n8n).
  - **Documentos** — archivos por entidad/fase. **Métricas** — embudo, conversión por etapa, CAC por canal/campaña, pipeline ponderado.
- Lecturas con Drizzle + paginación; mutaciones por Server Actions con revalidación; cada mutación relevante escribe en `eventos`.

---

## 9. SEO y contenido
- `generateMetadata` por página; `metadataBase`; canónicas; OG dinámico con `next/og`.
- `sitemap.ts` + `robots.ts` (bloquear `/admin`).
- **JSON-LD**: `Organization`, `LocalBusiness` (Aguascalientes), `FAQPage`, `BreadcrumbList`.
- Blog/casos/FAQ en **MDX** (`content/`), compilado con Velite a datos tipados (cero llamadas a CMS en runtime). Contenido orientado a intención local ("paneles solares Aguascalientes", costos, incentivos, Net Metering).

## 10. Performance (objetivo: Lighthouse ≥ 95, LCP < 2.0s)
- Marketing en **SSG/ISR** (`export const revalidate`); evitar `dynamic` salvo formularios.
- `next/image` (AVIF/WebP), `next/font` (self-host), JS de cliente mínimo (Server Components por defecto).
- `output: 'standalone'` para imagen Docker chica.
- Cache-Control para estáticos; **Cloudflare** cachea HTML estático y assets. Sin librerías pesadas; tree-shaking; presupuesto de bundle.

## 11. Seguridad
- Headers en `middleware.ts`/`next.config`: HSTS, X-Content-Type-Options, X-Frame-Options=DENY, Referrer-Policy, Permissions-Policy y **CSP** (allowlist: self, Pixel/Connect de Meta, Turnstile, GA).
- **HMAC** entrante y saliente (anti-replay 5 min). Validación Zod doble (cliente+servidor). **Turnstile** + honeypot + **rate-limit** por IP (tabla ligera o LRU en memoria).
- Secretos solo server-side; `lib/env.ts` valida envs con Zod al boot.
- **LFPDPPP**: checkbox de consentimiento + enlace al Aviso de Privacidad (reusar `Anexo_E_Aviso_Privacidad`); separar finalidad primaria de marketing.
- `/admin` con Auth.js; contraseñas argon2; sesiones JWT con expiración.

## 12. Despliegue (DigitalOcean + Cloudflare)
- **Dockerfile** multi-stage (deps → build → runner `node:20-alpine`, usuario no-root, `output:standalone`). Exponer 3000. `/api/health` para healthcheck.
- **docker-compose.yml**: servicio `energy-web` (env_file, `mem_limit`, `restart: unless-stopped`) + **Caddy** (TLS + reverse proxy). Si se co-hostea con n8n, añadirlo a su compose con límites; si Droplet dedicado, compose propio. Postgres por `DATABASE_URL` (IP privada `10.124.0.3` misma VPC, o Managed Postgres).
- **Caddyfile**:
```
energy.jygasoft.com {
  encode zstd gzip
  reverse_proxy energy-web:3000
}
```
- **Cloudflare**: registro **A `energy` → IP del servidor**, **proxied**; SSL **Full (Strict)** con **Origin Certificate** en Caddy (o deja que Caddy emita Let's Encrypt y usa Full Strict). Reglas de caché para `/_next/static`.
- Migraciones: aplicar `0000_init.sql` una vez; luego `drizzle-kit migrate` en el arranque/deploy.

## 13. Testing y verificación (antes de declarar "listo")
- **Unit (Vitest):** `calc.ts` (casos borde: solo recibo, solo consumo, CP sin HSP→fallback), `hmac.ts` (firma/verify/replay), `leadScore.ts`.
- **E2E (Playwright):** enviar formulario lead (mock de n8n) → verifica fila en `leads` + `form_submissions`; calculadora devuelve número y guarda simulación; `/admin` exige login.
- **Calidad:** `tsc --noEmit`, ESLint, `next build` sin errores; Lighthouse CI en Home y /calculadora.
- **Seguridad:** probar replay (timestamp viejo) y firma inválida → 401; rate-limit dispara; headers presentes.

---

## 14. Orden de construcción (fases con checkpoint)
1. **Scaffold:** Next.js+TS+Tailwind+shadcn, env validado, Dockerfile/health. ✅ build corre.
2. **DB:** Drizzle schema = `Esquema_BD_Postgres.sql`, conexión, migración inicial aplicada, seeds. ✅ `\dt` y query de prueba.
3. **HMAC + /api/lead + form lead** (mock n8n) + `form_submissions/leads/eventos`. ✅ E2E happy path.
4. **Calculadora** (lib/calc + /calculadora + persistencia). ✅ unit + captura lead.
5. **Marketing pages** (home, casa, negocio, como-funciona, faq, contacto, legal) + SEO + MDX blog/casos. ✅ Lighthouse ≥95.
6. **Meta Pixel + CAPI** (dedupe event_id). ✅ evento de prueba.
7. **Mini-CRM** (Auth.js + módulos: leads, clientes/contactos, oportunidades/pipeline, cotizaciones+items, proyectos+trámite CFE+instalaciones+materiales, pagos, catálogo, campañas, actividades, documentos, métricas) + inbound `/api/webhooks/n8n` + timeline `eventos`. ✅ login, kanban, conversión lead→cliente→oportunidad, update de estado por webhook.
8. **Deploy** (compose + Caddy + Cloudflare DNS). ✅ `https://energy.jygasoft.com` sirviendo, health OK.

## 15. Criterios de aceptación
- Un lead enviado desde el sitio **queda en Postgres y llega a n8n firmado** (idempotente).
- La calculadora devuelve sizing/inversión/ahorro coherentes y captura el lead con disclaimer PML.
- `/admin` protegido; se ve el embudo y se puede reasignar/avanzar estado; n8n puede actualizar estado por webhook.
- Lighthouse ≥ 95 en marketing; sin secretos en el cliente; headers de seguridad y HMAC anti-replay activos.

## 16. Decisiones abiertas (ajustables, no bloquean el build)
- **CMS:** MDX en v1; si quieren WordPress headless, añadir adaptador en `lib/content/` (misma interfaz) en Fase 2.
- **Calculadora:** arranca con HSP por zona (tabla `hsp_zonas`) + constantes de costo a **calibrar con el catálogo** (`10_Catalogo`).
- **Placement:** co-host vs Droplet dedicado (no cambia el código; solo `DATABASE_URL` y dónde corre el compose).
- **Rate-limit store:** LRU en memoria v1; si hay varios procesos, mover a Postgres/Redis.
