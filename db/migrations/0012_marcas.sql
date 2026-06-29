-- =====================================================================
-- 0012 — Catálogo de Marcas.
-- Entidad de catálogo (grupo "Catálogos"). Anti-duplicados por nombre_normalizado.
-- Idempotente. Backfill de las marcas ya usadas (texto libre) en productos.
-- =====================================================================
CREATE TABLE IF NOT EXISTS marcas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             text NOT NULL,
  nombre_normalizado text NOT NULL UNIQUE,
  descripcion        text,
  activo             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_marcas_activo ON marcas (activo);
DROP TRIGGER IF EXISTS trg_marcas_upd ON marcas;
CREATE TRIGGER trg_marcas_upd BEFORE UPDATE ON marcas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Backfill: marcas distintas presentes en productos (texto libre), normalizando
-- a minúsculas + espacios colapsados. Ignora vacíos y guiones.
INSERT INTO marcas (nombre, nombre_normalizado)
SELECT DISTINCT btrim(p.marca), lower(regexp_replace(btrim(p.marca), '\s+', ' ', 'g'))
FROM productos p
WHERE p.marca IS NOT NULL
  AND btrim(p.marca) NOT IN ('', '-')
ON CONFLICT (nombre_normalizado) DO NOTHING;
