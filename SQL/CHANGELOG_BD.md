# Changelog de Base de Datos

Registro cronológico de cambios al esquema de la base de datos (Postgres).
Cada cambio tiene su migración idempotente en `db/migrations/` y se aplica con:

```bash
pnpm db:apply-sql db/migrations/<archivo>.sql
```

El esquema canónico vive en `SQL/Esquema_BD_Postgres.sql` y el modelo Drizzle en
`db/schema.ts`. Mantener los tres en sincronía al introducir un cambio.

---

## 0021 — Varios líderes por área · 2026-07-01

**Migración:** `db/migrations/0021_area_lideres.sql`

- Nueva tabla `area_lideres` (PK area_id+usuario_id, `orden`): permite N líderes por
  área (p. ej. Operaciones = Director + Subdirectora). El "rol" de cada líder es el
  cargo del usuario (catálogo `cargos`). FK a areas/usuarios ON DELETE CASCADE.
- `areas.lider_id` se conserva como **líder principal** (= lideres[0]) por
  compatibilidad; se sincroniza al guardar los líderes.
- Backfill: el `lider_id` existente se copia como líder principal (orden 0).

---

## 0020 — Catálogo de Cargos · 2026-07-01

**Migración:** `db/migrations/0020_cargos.sql`

- Nueva tabla `cargos` (catálogo administrable): `nombre`, `nombre_normalizado`
  (unique, anti-duplicados), `activo`, `orden`, trigger `updated_at`.
- `usuarios.cargo_id` (uuid, FK→cargos ON DELETE SET NULL) + índice `ix_usuarios_cargo`.
  El cargo del usuario pasa a elegirse del catálogo; la columna de texto
  `usuarios.cargo` se conserva como valor **denormalizado** para mostrar (se
  mantiene sincronizada al guardar).
- Backfill: los valores distintos de `usuarios.cargo` se insertan en `cargos` y se
  enlaza `cargo_id` por nombre normalizado (sin acentos, minúsculas).

---

## 0019 — Áreas anidadas (árbol de departamentos) · 2026-06-30

**Migración:** `db/migrations/0019_areas_arbol.sql`

- `areas.padre_id` (uuid, FK→areas ON DELETE SET NULL): convierte las áreas en un
  árbol. Un área raíz (Comercial) tiene sub-áreas (Ventas, Preventas) que a su vez
  pueden tener las suyas (Finanzas → Cuentas por Pagar / por Cobrar). NULL = raíz.
- Índice `ix_areas_padre`. Al borrar un padre, sus hijas quedan como raíz.
- El guard anti-ciclos vive en la acción `actualizarArea` (un área no puede colgar
  de sí misma ni de una descendiente suya).

---

## 0018 — Integraciones/configuraciones en BD (secretos cifrados) · 2026-06-30

**Migración:** `db/migrations/0018_integraciones.sql`

- Nueva tabla `integraciones` (una fila por conexión): `ajustes` (jsonb en claro),
  `secretos` (jsonb cifrado AES-256-GCM — la llave `CONFIG_ENC_KEY` vive solo en
  el env), `activo`, `actualizado_por` (FK→usuarios), trigger `updated_at`.
- Complementa a `config_parametros` (parámetros de negocio no sensibles).

---

## 0017 — Asesores especializados con Chatwoot (Fase 1) · 2026-06-30

**Migración:** `db/migrations/0017_asesor_chatwoot.sql`

- `asesores.chatwoot_agent_id` pasa a **nullable** (un asesor puede existir antes
  de aprovisionarse/enlazarse en Chatwoot).
- Nuevos: `asesores.email` (invitar/reconciliar por correo), `chatwoot_estado`
  (`no_sincronizado|invitado|activo|error`, default `no_sincronizado`),
  `chatwoot_sync_at`, `chatwoot_error`. Índice `ix_asesores_email (lower(email))`.

---

## 0016 — Estructura organizacional (Fase 1) · 2026-06-29

**Migración:** `db/migrations/0016_organizacion.sql`

- Nueva tabla `areas` (departamentos): `nombre`, `nombre_normalizado` (único),
  `descripcion`, `lider_id` (FK → `usuarios`), `activa`. Trigger `updated_at`.
- `usuarios.reporta_a` (FK self → `usuarios`, `ON DELETE SET NULL`): línea de
  reporte/organigrama. `usuarios.cargo` (título). `usuarios.area_id` (FK → `areas`).
  Índices `ix_usuarios_reporta_a`, `ix_usuarios_area`.
- Solo estructura + organigrama; NO altera todavía visibilidad de datos ni la
  regla de asignación (fases posteriores).

---

## 0015 — Prioridad en actividades · 2026-06-29

**Migración:** `db/migrations/0015_actividad_prioridad.sql`

- Nuevo enum `actividad_prioridad` (`baja|media|alta`).
- `actividades.prioridad` (NOT NULL, default `'media'`) + índice
  `ix_act_prioridad (prioridad, vence_at)` para ordenar/filtrar la agenda.

---

## 0014 — Enlace productos → marcas · 2026-06-29

**Migración:** `db/migrations/0014_producto_marca_fk.sql`

- `productos.marca_id` (FK → `marcas`, `ON DELETE SET NULL`) + índice. Se conserva
  `productos.marca` (texto) como espejo del nombre para no tocar las lecturas
  existentes (catálogo, galería, cotización). Backfill por nombre normalizado.

---

## 0013 — Imagen (logo) de marca · 2026-06-29

**Migración:** `db/migrations/0013_marca_imagen.sql`

- `marcas.imagen_url` + `marcas.imagen_item_id` (logo en M365 SharePoint/OneDrive,
  mismo patrón que `productos`). Subida vía `lib/m365/sharepoint.ts`.

---

## 0012 — Catálogo de Marcas · 2026-06-29

**Migración:** `db/migrations/0012_marcas.sql`

- Nueva tabla `marcas` (grupo "Catálogos"): `nombre`, `nombre_normalizado`
  (único, anti-duplicados), `descripcion`, `activo`, timestamps. Primer catálogo
  del nuevo módulo. Backfill de las marcas ya usadas en `productos` (texto libre).

---

## 0011 — Descuento general del paquete · 2026-06-29

**Migración:** `db/migrations/0011_paquete_descuento.sql`

- `paquetes.descuento_pct` (numeric, 0–100, default 0). Al aplicar el paquete a
  una cotización, se descuenta de CADA línea: `precio_unitario = precio_fijo *
  (1 - descuento_pct/100)`. El total mostrado del paquete ya refleja el descuento.

---

## 0010 — Imagen de producto (M365 SharePoint/OneDrive) · 2026-06-29

**Migración:** `db/migrations/0010_producto_imagen.sql`

- `productos.imagen_url` (webUrl de SharePoint/OneDrive para mostrar) +
  `productos.imagen_item_id` (id de Graph, para reemplazar/borrar). La subida
  reutiliza `lib/m365/sharepoint.ts` (configurable por env M365_DOCS_*; nada local).

---

## 0009 — Módulo Paquetes (bundles para cotizaciones) · 2026-06-29

**Migración:** `db/migrations/0009_paquetes.sql`

- **`productos.naturaleza`** (`'producto' | 'servicio'`, default `'producto'`): un
  servicio/mano de obra es un producto con `naturaleza='servicio'`. Se siembran
  tipos *Servicio / Instalación / Trámite CFE / Mano de obra*.
- **`paquetes`**: bundle con `segmento` (enum `paquete_segmento`:
  residencial/comercial/industrial), `capacidad_kwp` nominal (para el "mejor
  ajuste"), `activo`, y anti-duplicados (`clave` única + `nombre_normalizado` única).
- **`paquete_lineas`**: líneas que referencian un `producto_id`, con `precio_fijo`
  (snapshot que manda al cotizar), `ya_notificado` (anti-spam del correo de
  desviación) y `orden`. `ON DELETE CASCADE` desde el paquete.
- **Trigger** `trg_productos_precio_reset_notif`: al cambiar `precio_venta` de un
  producto, resetea `ya_notificado` en las líneas de paquete con `precio_fijo`
  distinto (para volver a alertar). Sin lógica de correo en la BD.
- Aplicar un paquete **copia** sus líneas a `cotizacion_items` (no hay FK; la
  cotización queda independiente).

---

## 0008 — Backfill cotización → oportunidad (monto en pipeline) · 2026-06-28

**Migración:** `db/migrations/0008_cotizaciones_oportunidad_backfill.sql`

- Enlaza las cotizaciones **huérfanas** (creadas antes de la sincronización
  automática) a la oportunidad **abierta** más reciente de su cliente.
- Refleja el `total` de la cotización enlazada en `oportunidades.monto_estimado`
  (solo oportunidades abiertas y total > 0; ante varias, gana la de mayor total).
- Idempotente. Reconcilia datos existentes; el flujo nuevo ya enlaza/sincroniza
  al crear/editar partidas/dimensionar (ver acciones en `lib/admin/actions.ts`).

---

## 0007 — Productos: re-cableado de FK + retiro de catalogo_equipos · 2026-06-26

**Migración:** `db/migrations/0007_productos_recableado.sql`

- Cierra la unificación de 0006: las FK `equipo_id` pasan de `catalogo_equipos`
  a `productos` (con `ON DELETE SET NULL`):
  - `cotizacion_items.equipo_id` → `productos(id)`.
  - `proyecto_materiales.equipo_id` → `productos(id)`.
- Como el backfill de 0006 conservó el mismo `id`, **no hay datos que ajustar**.
  La migración incluye una salvaguarda (DO block) que **aborta** si quedara
  algún `equipo_id` huérfano antes de re-cablear.
- **`DROP TABLE catalogo_equipos`** (ya migrado a `productos`). El enum
  `equipo_tipo` se conserva (sin usos en tablas) por compatibilidad de tipos.
- App: `getCatalogoDisponible` lee de `productos` (tipo = `producto_tipos.clave`,
  `potencia_wp` desde `atributos`, precio = `precio_venta`); se retiró la página
  y el módulo RBAC `catalogo` (sustituidos por `productos`).

---

## 0006 — Módulo Productos (catálogo unificado) · 2026-06-26

**Migración:** `db/migrations/0006_productos.sql`

- **`producto_tipos`**: catálogo de tipos **editable** (id, `nombre` único, `clave`
  único, descripcion, activo, timestamps). Reemplaza al enum hardcodeado
  `equipo_tipo`. Seed: Panel, Inversor, Estructura de montaje, Material eléctrico,
  Protecciones (+ "Otro" para preservar filas existentes).
- **`productos`**: catálogo de productos con `producto_tipo_id` (FK), `sku` único,
  nombre, marca, modelo, descripcion, unidad, `precio_compra`, `precio_venta`,
  moneda, stock, activo y **`atributos` jsonb** (specs flexibles por tipo).
- **Backfill aditivo y seguro**: las filas de `catalogo_equipos` se copian a
  `productos` **conservando el mismo `id`** (specs+potencia_wp → `atributos`,
  precio → precio_venta), de modo que las FK `equipo_id` de cotizaciones/proyectos
  siguen válidas. El re-cableado a `productos` se hará en una migración posterior.

---

## 0005 — Parámetros de costeo (cotizaciones) · 2026-06-26

**Migración:** `db/migrations/0005_costeo_cotizacion.sql` — constantes de costeo
en `config_parametros` (panel, estructura, material, protecciones, mano de obra,
inversor) para el wizard de dimensionamiento.

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
