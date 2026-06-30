-- =====================================================================
-- 0016 — Estructura organizacional (Fase 1).
-- Áreas/departamentos + línea de reporte y cargo en usuarios. Solo estructura
-- y organigrama; NO altera todavía la visibilidad de datos ni la asignación
-- (eso son fases posteriores). Idempotente.
-- =====================================================================

-- Áreas / departamentos (Comercial, Operaciones, Finanzas, Postventa…).
CREATE TABLE IF NOT EXISTS areas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             text NOT NULL,
  nombre_normalizado text NOT NULL,
  descripcion        text,
  lider_id           uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  activa             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_areas_nombre_norm ON areas (nombre_normalizado);
CREATE INDEX IF NOT EXISTS ix_areas_lider ON areas (lider_id);

DROP TRIGGER IF EXISTS trg_areas_upd ON areas;
CREATE TRIGGER trg_areas_upd BEFORE UPDATE ON areas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Jerarquía en usuarios: jefe directo (línea de reporte), cargo y área.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reporta_a uuid;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cargo     text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS area_id   uuid;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_reporta_a_fkey;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_reporta_a_fkey
  FOREIGN KEY (reporta_a) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_area_id_fkey;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_area_id_fkey
  FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_usuarios_reporta_a ON usuarios (reporta_a);
CREATE INDEX IF NOT EXISTS ix_usuarios_area ON usuarios (area_id);
