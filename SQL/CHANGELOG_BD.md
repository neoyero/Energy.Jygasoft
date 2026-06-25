# Changelog de Base de Datos

Registro cronológico de cambios al esquema de la base de datos (Postgres).
Cada cambio tiene su migración idempotente en `db/migrations/` y se aplica con:

```bash
pnpm db:apply-sql db/migrations/<archivo>.sql
```

El esquema canónico vive en `SQL/Esquema_BD_Postgres.sql` y el modelo Drizzle en
`db/schema.ts`. Mantener los tres en sincronía al introducir un cambio.

---

## 0004 — Catálogos geográficos (estado → municipio → CP) · 2026-06-25

**Migración:** `db/migrations/0004_geo_estados_municipios.sql`

- **Nuevas tablas maestras** pobladas desde las claves INEGI de `codigos_postales`
  (100% pobladas, sin huérfanos):
  - `estados` (32): `clave` INEGI (PK), `nombre` (UNIQUE).
  - `municipios` (2,478): `id` + `(clave_estado → estados, clave_mnpio)` UNIQUE + `nombre`.
- **Relaciones (FK):**
  - `codigos_postales (c_estado, c_mnpio)` → `municipios` (FK compuesta) + índice.
  - `hsp_estados.estado_clave` → `estados` (backfill por nombre; los 32 coinciden).
  - `hsp_zonas.municipio_id` → `municipios` (override de HSP por municipio).
  - `leads.municipio_id` y `clientes.municipio_id` → `municipios` (**NULL-able**,
    `ON DELETE SET NULL`; backfill best-effort por nombre+estado) + índices.
- **Jerarquía resultante:** un estado tiene municipios; un municipio tiene
  códigos postales. La calculadora conserva su resolución HSP (zona › estado ›
  fallback), ahora con integridad referencial.

---

## 0003 — Asesores · 2026-06-25

**Migración:** `db/migrations/0003_asesores.sql`

- **Nueva tabla `asesores`**: subconjunto de `usuarios` habilitados para
  recibir/atender leads. Incluye el `chatwoot_agent_id` (agente de Chatwoot) y
  reglas de ruteo (`zonas`, `segmentos`) para el reparto automático
  (round-robin vía `asignaciones`).
  - `usuario_id uuid` → FK a `usuarios(id)` `ON DELETE SET NULL` (vínculo con la
    cuenta del panel; un asesor sin vínculo no es asignable a leads).
  - `chatwoot_agent_id integer NOT NULL`, `ms_email`, `telefono`.
  - `zonas text[]`, `segmentos text[]` (vacío = sin restricción).
  - `activo boolean`, `asignaciones integer` (contador de carga).
  - Índice `ix_asesores_activo`.
- **Regla de negocio:** a partir de aquí, **solo** los usuarios con un asesor
  activo y vinculado (`asesores.usuario_id`) pueden asignarse como responsables
  de un lead (`leads.vendedor_id`). Validado en `asignarLead`, `crearLead` y
  `actualizarLead`.

---

## 0002 — je-admin: login OTP + rol preventa

**Migración:** `db/migrations/0002_je_admin_auth.sql`

- `ALTER TYPE usuario_rol ADD VALUE 'preventa'`.
- `usuarios.ultimo_acceso timestamptz`.
- Nueva tabla `login_codes` (OTP passwordless por correo).

---

## 0001 — Códigos postales (SEPOMEX)

**Migración:** `db/migrations/0001_codigos_postales.sql`

- Nueva tabla `codigos_postales` (catálogo nacional) + seed de `hsp_estados`.

---

## 0000 — Esquema inicial

**Migración:** `db/migrations/0000_init.sql`

- Esquema base del CRM (usuarios, leads, clientes, oportunidades, cotizaciones,
  proyectos, etc.).
