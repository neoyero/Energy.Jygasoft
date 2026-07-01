-- 0021_area_lideres.sql
-- Varios líderes por área (Operaciones = Director + Subdirectora, etc.). El "rol"
-- de cada líder es el cargo del usuario (catálogo cargos). Se conserva
-- `areas.lider_id` como líder principal (= lideres[0]) por compatibilidad.
-- Idempotente.

CREATE TABLE IF NOT EXISTS area_lideres (
  area_id    uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  orden      int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (area_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS ix_area_lideres_usuario ON area_lideres (usuario_id);

-- Backfill: el líder actual (areas.lider_id) pasa a area_lideres como principal.
INSERT INTO area_lideres (area_id, usuario_id, orden)
SELECT id, lider_id, 0 FROM areas WHERE lider_id IS NOT NULL
ON CONFLICT (area_id, usuario_id) DO NOTHING;
