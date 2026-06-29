-- =====================================================================
-- 0009 — Módulo Paquetes (bundles para cotizaciones).
--
-- Un paquete agrupa líneas que referencian PRODUCTOS del catálogo (incluidos
-- servicios: un servicio es un producto con naturaleza='servicio'). Aplicar un
-- paquete copia sus líneas a cotizacion_items con su precio_fijo (snapshot).
-- Capa de alerta: precio_fijo vs precio_venta vivo; ya_notificado controla el
-- anti-spam del correo (se resetea por trigger al cambiar el precio del producto).
-- Idempotente.
-- =====================================================================

-- 1) Naturaleza del producto (producto|servicio). Default 'producto' para todo
--    lo existente. Un servicio se referencia en paquetes igual que un producto.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS naturaleza text NOT NULL DEFAULT 'producto';
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_naturaleza_check;
ALTER TABLE productos ADD CONSTRAINT productos_naturaleza_check
  CHECK (naturaleza IN ('producto', 'servicio'));

-- 2) Tipos de producto para servicios (producto_tipo_id es obligatorio, así que
--    los servicios necesitan su categoría). clave estable.
INSERT INTO producto_tipos (nombre, clave, descripcion) VALUES
  ('Servicio',     'servicio',    'Servicios'),
  ('Instalación',  'instalacion', 'Mano de obra de instalación'),
  ('Trámite CFE',  'tramite_cfe', 'Trámites e interconexión CFE'),
  ('Mano de obra', 'mano_obra',   'Mano de obra y montaje')
ON CONFLICT (clave) DO NOTHING;

-- 3) Segmento del paquete (derivado en la app de cliente.tipo_persona).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paquete_segmento') THEN
    CREATE TYPE paquete_segmento AS ENUM ('residencial', 'comercial', 'industrial');
  END IF;
END $$;

-- 4) Paquetes. Anti-duplicados: clave única + nombre_normalizado único
--    (la app normaliza: minúsculas, sin acentos, trim).
CREATE TABLE IF NOT EXISTS paquetes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             text NOT NULL,
  nombre_normalizado text NOT NULL,
  clave              text NOT NULL,
  descripcion        text,
  segmento           paquete_segmento NOT NULL,
  capacidad_kwp      numeric(10,2),                 -- nominal, para "mejor ajuste"
  activo             boolean NOT NULL DEFAULT true,
  moneda             text NOT NULL DEFAULT 'MXN',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paquetes_clave_key UNIQUE (clave),
  CONSTRAINT paquetes_nombre_normalizado_key UNIQUE (nombre_normalizado)
);
CREATE INDEX IF NOT EXISTS ix_paquetes_segmento ON paquetes (segmento);
CREATE INDEX IF NOT EXISTS ix_paquetes_activo   ON paquetes (activo);
DROP TRIGGER IF EXISTS trg_paquetes_upd ON paquetes;
CREATE TRIGGER trg_paquetes_upd BEFORE UPDATE ON paquetes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5) Líneas del paquete: referencian un producto del catálogo; precio_fijo es el
--    snapshot que manda. ya_notificado: control de spam del correo de desviación.
CREATE TABLE IF NOT EXISTS paquete_lineas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paquete_id    uuid NOT NULL REFERENCES paquetes(id) ON DELETE CASCADE,
  producto_id   uuid NOT NULL REFERENCES productos(id),
  descripcion   text,                               -- snapshot/override de la descripción
  cantidad      numeric(12,2) NOT NULL DEFAULT 1,
  precio_fijo   numeric(14,2) NOT NULL DEFAULT 0,    -- snapshot; manda al cotizar
  ya_notificado boolean NOT NULL DEFAULT false,
  orden         integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_paquete_lineas_paquete  ON paquete_lineas (paquete_id);
CREATE INDEX IF NOT EXISTS ix_paquete_lineas_producto ON paquete_lineas (producto_id);
DROP TRIGGER IF EXISTS trg_paquete_lineas_upd ON paquete_lineas;
CREATE TRIGGER trg_paquete_lineas_upd BEFORE UPDATE ON paquete_lineas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6) Reset anti-spam: al cambiar el precio_venta de un producto, las líneas de
--    paquete cuyo precio_fijo difiera quedan "no notificadas" para volver a
--    avisar de la nueva desviación. (Sin lógica de correo en la BD.)
CREATE OR REPLACE FUNCTION reset_paquete_linea_notificacion() RETURNS trigger AS $$
BEGIN
  UPDATE paquete_lineas
     SET ya_notificado = false
   WHERE producto_id = NEW.id
     AND precio_fijo IS DISTINCT FROM NEW.precio_venta;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_productos_precio_reset_notif ON productos;
CREATE TRIGGER trg_productos_precio_reset_notif
  AFTER UPDATE OF precio_venta ON productos
  FOR EACH ROW EXECUTE FUNCTION reset_paquete_linea_notificacion();
