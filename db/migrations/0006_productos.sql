-- =====================================================================
-- 0006 — Módulo Productos (catálogo unificado). Reemplaza progresivamente a
-- catalogo_equipos: el "tipo" pasa de enum hardcodeado a una tabla editable
-- (producto_tipos) y los productos llevan atributos JSON flexibles por tipo.
--
-- Esta migración es ADITIVA y SEGURA: crea las tablas, siembra los tipos y
-- copia las filas de catalogo_equipos a productos CONSERVANDO el mismo id
-- (para que las FK equipo_id de cotizaciones/proyectos sigan siendo válidas).
-- El re-cableado de esas FK y del wizard se hace en una migración posterior.
-- Idempotente.
-- =====================================================================

-- 1) Catálogo de tipos (editable por el usuario) ---------------------------
CREATE TABLE IF NOT EXISTS producto_tipos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  clave       text NOT NULL UNIQUE,              -- slug estable, p. ej. 'panel'
  descripcion text,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_producto_tipos_upd ON producto_tipos;
CREATE TRIGGER trg_producto_tipos_upd BEFORE UPDATE ON producto_tipos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2) Productos -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_tipo_id uuid NOT NULL REFERENCES producto_tipos(id),
  sku              text UNIQUE,                  -- código; único (admite NULL)
  nombre           text NOT NULL,
  marca            text,
  modelo           text,
  descripcion      text,
  unidad           text NOT NULL DEFAULT 'pieza',
  precio_compra    numeric(14,2),
  precio_venta     numeric(14,2),
  moneda           text NOT NULL DEFAULT 'MXN',
  stock            integer,
  activo           boolean NOT NULL DEFAULT true,
  atributos        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- specs propias del tipo
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_productos_tipo   ON productos (producto_tipo_id);
CREATE INDEX IF NOT EXISTS ix_productos_activo ON productos (activo);
DROP TRIGGER IF EXISTS trg_productos_upd ON productos;
CREATE TRIGGER trg_productos_upd BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3) Seed de tipos iniciales (clave alineada con el enum equipo_tipo para el
--    backfill; "Otro" se incluye para no perder filas tipo 'otro'). ---------
INSERT INTO producto_tipos (nombre, clave, descripcion) VALUES
  ('Panel',                 'panel',              'Módulos fotovoltaicos'),
  ('Inversor',              'inversor',           'Inversores y microinversores'),
  ('Estructura de montaje', 'estructura',         'Estructura y soportería'),
  ('Material eléctrico',    'material_electrico', 'Cable, conectores y material eléctrico'),
  ('Protecciones',          'protecciones',       'Centros de carga, supresores y protecciones'),
  ('Otro',                  'otro',               'Otros productos')
ON CONFLICT (clave) DO NOTHING;

-- 4) Backfill: catalogo_equipos -> productos (mismo id; atributos desde specs)
INSERT INTO productos (
  id, producto_tipo_id, sku, nombre, marca, modelo, descripcion, unidad,
  precio_compra, precio_venta, moneda, stock, activo, atributos,
  created_at, updated_at
)
SELECT
  ce.id,
  pt.id,
  NULL,
  COALESCE(NULLIF(trim(concat_ws(' ', ce.marca, ce.modelo)), ''), 'Equipo'),
  ce.marca,
  ce.modelo,
  NULL,
  'pieza',
  NULL,
  ce.precio,
  COALESCE(ce.moneda, 'MXN'),
  NULL,
  COALESCE(ce.disponible, true),
  COALESCE(ce.specs, '{}'::jsonb)
    || (CASE WHEN ce.potencia_wp IS NOT NULL
             THEN jsonb_build_object('potencia_wp', ce.potencia_wp)
             ELSE '{}'::jsonb END),
  ce.created_at,
  ce.updated_at
FROM catalogo_equipos ce
JOIN producto_tipos pt ON pt.clave = ce.tipo::text
ON CONFLICT (id) DO NOTHING;
