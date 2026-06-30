-- =====================================================================
-- 0015 — Prioridad en actividades.
-- Agrega el enum actividad_prioridad (baja|media|alta) y la columna
-- `prioridad` a `actividades` (default 'media'). Índice para ordenar/filtrar
-- la agenda por prioridad + vencimiento. Idempotente.
-- =====================================================================

-- Enum de prioridad (CREATE TYPE no admite IF NOT EXISTS -> guard con DO).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'actividad_prioridad') THEN
    CREATE TYPE actividad_prioridad AS ENUM ('baja', 'media', 'alta');
  END IF;
END$$;

ALTER TABLE actividades
  ADD COLUMN IF NOT EXISTS prioridad actividad_prioridad NOT NULL DEFAULT 'media';

-- Para ordenar la agenda por (prioridad, vencimiento) sin escaneo completo.
CREATE INDEX IF NOT EXISTS ix_act_prioridad ON actividades (prioridad, vence_at);
