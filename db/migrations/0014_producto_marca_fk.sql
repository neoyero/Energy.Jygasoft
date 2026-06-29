-- =====================================================================
-- 0014 — Enlace productos → marcas (catálogo).
-- Agrega marca_id (FK) a productos; se conserva la columna `marca` (texto) como
-- espejo del nombre para no tocar las lecturas existentes. Backfill por nombre
-- normalizado. Idempotente.
-- =====================================================================
ALTER TABLE productos ADD COLUMN IF NOT EXISTS marca_id uuid;
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_marca_id_fkey;
ALTER TABLE productos ADD CONSTRAINT productos_marca_id_fkey
  FOREIGN KEY (marca_id) REFERENCES marcas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_productos_marca ON productos (marca_id);

-- Backfill: enlaza por nombre normalizado (minúsculas + espacios colapsados).
UPDATE productos p
SET marca_id = m.id
FROM marcas m
WHERE p.marca_id IS NULL
  AND p.marca IS NOT NULL
  AND m.nombre_normalizado = lower(regexp_replace(btrim(p.marca), '\s+', ' ', 'g'));
