-- 0019_areas_arbol.sql
-- Áreas anidadas (árbol de departamentos): cada área puede colgar de un área
-- padre. Comercial → (Ventas, Preventas); Administración → Finanzas → (CxP, CxC).
-- ON DELETE SET NULL: al borrar un padre, sus hijas quedan como raíz (no cascada).
-- Idempotente.

ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS padre_id uuid REFERENCES areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_areas_padre ON areas (padre_id);
