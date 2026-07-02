# Multi-tenant — Enforcement (Fase 2, rama `multi-tenant-enforcement`)

Objetivo: aislamiento 100% por empresa (RLS en Postgres + scoping en la app), con
**super-admin** que ve/gestiona todas. Cimiento ya en `main`: migración `0025`
agregó `empresa_id` (nullable, backfill a Jygasoft) a las 28 tablas de negocio.

## Decisiones (confirmadas)
- **RLS + scoping en app** (doble candado).
- **Todo por empresa**; globales solo catálogos nacionales, `login_codes`,
  `webhook_log`, `integraciones` (infra compartida).
- **Super-admin multi-empresa** (Yerandy) con selector de empresa activa.

## Arquitectura
- **Contexto de tenant** (`lib/tenant/context.ts`): `AsyncLocalStorage` con
  `{ empresaId, superadmin }`. `runWithTenant()` lo establece por request desde la
  sesión (empresaId del usuario, o la empresa activa elegida por el super-admin).
- **RLS con GUC transaccional**: `conTenant(tx => …)` abre transacción y hace
  `SET LOCAL app.empresa_id` / `app.superadmin`. Evita fugas del pool (el GUC es
  transaccional). Las policies leen `current_setting('app.empresa_id', true)`.
- **Policy por tabla**: `USING (empresa_id = current_setting('app.empresa_id')::uuid
  OR current_setting('app.superadmin', true) = 'on')` y `WITH CHECK` análogo.

## Incrementos
1. **2C — Contexto + wiring** (EN CURSO): módulo de contexto (hecho). Establecer
   `runWithTenant` en el guard de je-admin (requirePerm/assertPerm) leyendo empresa
   de la sesión + empresa activa (super-admin). Migrar el acceso a BD a `conTenant`.
2. **2D — RLS**: `ENABLE ROW LEVEL SECURITY` + policies en las 28 tablas + rol de
   conexión sin BYPASSRLS. Empezar en modo permisivo (policy que permite si el GUC
   no está seteado) para migrar sin romper; luego endurecer a deny-by-default.
3. **2E — Scoping app + sync**: `empresa_id` en cada INSERT (desde `empresaActualId()`),
   filtro en lecturas clave, `schema.ts`/canónico al día, **uniques compuestos**
   (areas/cargos/marcas/paquetes/productos/folio por empresa).
4. **2F — Empresas**: módulo CRUD (`/je-admin/empresas`, super-admin) + **selector de
   empresa activa** (cookie `empresa_activa`) que alimenta `runWithTenant`.
5. **2G — Cierre**: `empresa_id` NOT NULL; endurecer RLS a deny-by-default; pruebas
   de aislamiento cross-tenant (empresa A no ve nada de B por UI/URL/API);
   revisión adversarial. Merge a `main`.

## Riesgos / notas
- El super-admin corre con `app.superadmin=on` → ve todo; el resto SIEMPRE acotado.
- Procesos fuera de request (seeds/scripts/webhooks) deben fijar empresa explícita o
  correr como superadmin, o RLS los deja sin filas.
- Cambios de permisos/empresa aplican al re-login (JWT) salvo el selector de empresa
  activa, que es por cookie/estado en vivo.
