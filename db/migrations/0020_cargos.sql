-- 0020_cargos.sql
-- Catálogo de Cargos (Director, Subdirector, Gerente, Coordinador…). El cargo del
-- usuario pasa a referenciar este catálogo (usuarios.cargo_id); se conserva la
-- columna de texto `usuarios.cargo` como valor denormalizado para mostrar (se
-- mantiene sincronizada al guardar). Idempotente.

CREATE TABLE IF NOT EXISTS cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  nombre_normalizado text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_cargos_nombre_norm ON cargos (nombre_normalizado);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cargos_upd') THEN
    CREATE TRIGGER trg_cargos_upd BEFORE UPDATE ON cargos
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Normalización equivalente a normalizarNombre() de la app (minúsculas, sin
-- acentos, espacios colapsados). Se usa igual en el INSERT y en el UPDATE para
-- que el emparejado sea consistente.
-- Backfill: cargos distintos ya presentes en usuarios.cargo.
INSERT INTO cargos (nombre, nombre_normalizado)
SELECT DISTINCT
  trim(cargo),
  lower(regexp_replace(
    translate(trim(cargo),
      'ÁÀÄÂÃáàäâãÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÑñÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc'),
    '\s+', ' ', 'g'))
FROM usuarios
WHERE cargo IS NOT NULL AND trim(cargo) <> ''
ON CONFLICT (nombre_normalizado) DO NOTHING;

-- usuarios.cargo_id → cargos.id (ON DELETE SET NULL: si se borra el cargo, el
-- usuario queda sin cargo del catálogo, pero conserva el texto denormalizado).
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS cargo_id uuid REFERENCES cargos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_usuarios_cargo ON usuarios (cargo_id);

UPDATE usuarios u
SET cargo_id = c.id
FROM cargos c
WHERE u.cargo_id IS NULL
  AND u.cargo IS NOT NULL
  AND lower(regexp_replace(
        translate(trim(u.cargo),
          'ÁÀÄÂÃáàäâãÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÑñÇç',
          'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc'),
        '\s+', ' ', 'g')) = c.nombre_normalizado;
